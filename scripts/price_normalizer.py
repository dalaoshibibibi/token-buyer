#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
price_normalizer.py — API价格标准化 & 合并 & 异常检测 & 输出

支持的输入格式：
  - Excel (.xlsx) — 最完整，直接读取
  - CSV (.csv) — 自动分隔符检测
  - JSON (.json) — 来自 scraper.js 网页抓取的标准化输出
  - WebFetch文本 — 从网页提取的表格文本（需要先解析）

配合 scraper.js 使用：scraper 产出 data/*.json 后，本脚本自动读取。

使用方法：
  python price_normalizer.py
    自动从 data/ 目录读取三平台数据

  python price_normalizer.py --mode apimart --input xxx.xlsx
    指定单个平台的文件
"""

import os
import sys
import json
import pandas as pd
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

# ====================== 全局固定配置 ======================
USD_CNY_RATE = 7
APIMART_DISCOUNT = 0.8
GRS_POINT_SMALL = 0.000100
GRS_POINT_TOP = 0.000050
GEEK_DISCOUNT_MAP = {"gpt-vip": 0.3, "国产模型": 0.7, "default": 1.0}

# ====================== 通用读取函数 ======================
def load_dataframe(path):
    """自动检测文件格式并加载为 DataFrame"""
    path = str(path)
    if not os.path.exists(path):
        print(f"  ⚠️ 文件不存在: {path}")
        return None

    ext = os.path.splitext(path)[1].lower()

    if ext == '.xlsx' or ext == '.xls':
        try:
            df = pd.read_excel(path)
            print(f"  ✅ 读取Excel: {os.path.basename(path)} ({len(df)}行)")
            return df
        except Exception as e:
            print(f"  ❌ Excel读取失败: {e}")
            return None

    elif ext == '.csv':
        try:
            df = pd.read_csv(path, encoding='utf-8-sig')
            if len(df.columns) < 2:
                df = pd.read_csv(path, encoding='gbk')
            print(f"  ✅ 读取CSV: {os.path.basename(path)} ({len(df)}行)")
            return df
        except Exception as e:
            print(f"  ❌ CSV读取失败: {e}")
            return None

    elif ext == '.json':
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, list):
                df = pd.DataFrame(data)
            elif isinstance(data, dict) and 'models' in data:
                df = pd.DataFrame(data['models'])
            else:
                df = pd.DataFrame([data])
            print(f"  ✅ 读取JSON: {os.path.basename(path)} ({len(df)}行)")
            return df
        except Exception as e:
            print(f"  ❌ JSON读取失败: {e}")
            return None

    else:
        print(f"  ❌ 不支持的文件格式: {ext}")
        return None


def find_platform_file(platform_key, data_dir='./data'):
    """自动查找指定平台的数据文件"""
    patterns = {
        'apimart': ['apimart', 'api_mart', 'API Mart', 'APIMart', 'AIUXU', 'aiuxu'],
        'geeknow': ['geeknow', 'GeekNow', 'geek_now', 'Geek', 'geek'],
        'grsai': ['grsai', 'grs_ai', 'GrsAI', 'GRS', 'grs']
    }

    pattern = patterns.get(platform_key, [platform_key])
    data_dir = Path(data_dir)
    if not data_dir.exists():
        return None

    for f in data_dir.glob('*'):
        fname = f.name.lower()
        for p in pattern:
            if p.lower() in fname:
                return str(f)
    return None


# ====================== 标准化函数 ======================
def normalize_apimart(df):
    df["输入单价_人民币"] = df.get("APIMart输入价格(美元/M)", 0) * USD_CNY_RATE * APIMART_DISCOUNT
    df["输出单价_人民币"] = df.get("APIMart输出价格(美元/M)", 0) * USD_CNY_RATE * APIMART_DISCOUNT
    df["单次单价_人民币"] = df.get("APIMart价格(美元/次)", 0) * USD_CNY_RATE * APIMART_DISCOUNT
    return df


def normalize_grs(df):
    """GrsAI：积分转人民币 + 两套价格"""
    if "积分消耗(次)" in df.columns:
        df["单次_小额充值"] = df["积分消耗(次)"] * GRS_POINT_SMALL
        df["单次_顶配999"] = df["积分消耗(次)"] * GRS_POINT_TOP
    if "输入最低(元/M)" in df.columns:
        df["输入_小额"] = df["输入最低(元/M)"]
        df["输入_顶配"] = df["输入最低(元/M)"] / 2
    if "输出最低(元/M)" in df.columns:
        df["输出_小额"] = df["输出最低(元/M)"]
        df["输出_顶配"] = df["输出最低(元/M)"] / 2
    return df


def normalize_geek(df):
    def calc_price(row):
        group = row.get("最低分组", "default")
        discount = GEEK_DISCOUNT_MAP.get(group, 1.0)
        if "按Token" in str(row.get("计费方式", "")):
            in_p = row.get("输入价格(元/M)", 0) * discount
            out_p = row.get("输出价格(元/M)", 0) * discount
            return in_p, out_p, None
        else:
            once_p = row.get("价格(元/次)", 0) * discount
            return None, None, once_p
    df[["输入折后", "输出折后", "单次折后"]] = df.apply(lambda x: pd.Series(calc_price(x)), axis=1, result_type="expand")
    return df


def detect_abnormal_price(row):
    price_list = []
    # 列名与各 normalize_* 函数的输出保持一致
    for col in ["输入单价_人民币", "输入折后", "输入_顶配"]:
        v = row.get(col)
        if pd.notna(v) and v > 0:
            price_list.append(v)
    if len(price_list) < 2:
        return ""
    min_p = min(price_list)
    avg_p = sum(price_list) / len(price_list)
    return "⚠️低价渠道风险，建议小批量测试稳定性" if min_p < avg_p * 0.5 else ""


def clean_model_name(name):
    """清洗模型名称：去后缀、统一大小写"""
    if not isinstance(name, str):
        return ""
    suffix_list = ["-latest", "-preview", "-high", "-low", "-medium", "-xhigh"]
    for s in suffix_list:
        name = name.replace(s, "")
    return name.strip().lower()


def merge_all_model(df_api, df_geek, df_grs):
    """三合一合并，匹配同名模型"""
    for df in [df_api, df_geek, df_grs]:
        if df is not None and "模型名称" in df.columns:
            df["clean_name"] = df["模型名称"].apply(clean_model_name)

    # 逐个合并（每个都可能为None）
    has_api = df_api is not None
    has_geek = df_geek is not None
    has_grs = df_grs is not None

    total = None
    if has_geek and has_grs:
        total = pd.merge(df_geek, df_grs, on="clean_name", how="outer", suffixes=("_geek", "_grs"))
    elif has_geek:
        total = df_geek.copy()
    elif has_grs:
        total = df_grs.copy()

    if total is not None and has_api:
        total = pd.merge(total, df_api, on="clean_name", how="outer", suffixes=("", "_api"))

    if total is None and has_api:
        total = df_api.copy()

    if total is None:
        print("  ❌ 没有任何数据可合并")
        return pd.DataFrame()

    # 最低价（尽可能多的列参与）
    price_cols = [c for c in ["输入折后", "输入_顶配", "输入单价_人民币"] if c in total.columns]
    if price_cols:
        total["全平台最低单价"] = total[price_cols].min(axis=1)
    total["风险提示"] = total.apply(detect_abnormal_price, axis=1)

    print(f"  ✅ 合并完成：{len(total)} 条记录")
    return total


def run_full_compare(api_path=None, geek_path=None, grs_path=None):
    """入口函数：自动查找文件并运行完整流程"""
    # data/ 位于 skill 根目录（scripts/ 的上一级）
    data_dir = Path(__file__).resolve().parent.parent / "data"
    data_dir.mkdir(exist_ok=True)

    # 查找文件
    paths = {
        'apimart': api_path or find_platform_file('apimart', data_dir),
        'geeknow': geek_path or find_platform_file('geeknow', data_dir),
        'grsai': grs_path or find_platform_file('grsai', data_dir)
    }

    for k, v in paths.items():
        if v:
            print(f"  [{k}] 使用文件: {v}")
        else:
            print(f"  [{k}] 未找到文件")

    # 加载
    df_api = load_dataframe(paths['apimart']) if paths['apimart'] else None
    df_geek = load_dataframe(paths['geeknow']) if paths['geeknow'] else None
    df_grs = load_dataframe(paths['grsai']) if paths['grsai'] else None

    # 如果有API端点抓取的JSON，读入缓存
    scrape_cache = data_dir / "scrape_cache.json"
    if scrape_cache.exists() and df_api is None:
        print("  尝试读取抓取缓存...")
        df_api = load_dataframe(str(scrape_cache))

    # 标准化
    if df_api is not None:
        df_api = normalize_apimart(df_api)
    if df_grs is not None:
        df_grs = normalize_grs(df_grs)
    if df_geek is not None:
        df_geek = normalize_geek(df_geek)

    # 合并
    result = merge_all_model(df_api, df_geek, df_grs)

    # 输出
    if len(result) > 0:
        output_path = data_dir / "三平台价格合并对比表.xlsx"
        result.to_excel(str(output_path), index=False)
        print(f"\n  ✅ 最终输出: {output_path} ({len(result)}条)")

    return result


# ====================== CLI入口 ======================
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='API价格标准化 & 合并工具')
    parser.add_argument('--mode', choices=['auto', 'single'], default='auto',
                       help='auto=全自动查找合并; single=指定单文件')
    parser.add_argument('--input', help='单文件路径（配合 --mode single 使用）')
    parser.add_argument('--platform', choices=['apimart', 'geeknow', 'grsai'],
                       help='指定平台（配合 --mode single 使用）')

    args = parser.parse_args()

    if args.mode == 'single' and args.input:
        # 处理单个文件
        df = load_dataframe(args.input)
        if df is not None:
            platform = args.platform or "unknown"
            if platform == "apimart":
                df = normalize_apimart(df)
            elif platform == "geeknow":
                df = normalize_geek(df)
            elif platform == "grsai":
                df = normalize_grs(df)
            print(df.to_string())
    else:
        # 自动模式
        run_full_compare()
