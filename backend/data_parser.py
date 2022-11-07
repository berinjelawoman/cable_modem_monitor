#%%
import os
import re
import json
import tarfile

from functools import reduce
from datetime import datetime

from typing import *

DATA_FOLDER = "/home/servidor/.bk"


def set_data_folder(path: str) -> None:
    global DATA_FOLDER
    DATA_FOLDER = f"/home/servidor/.bk/{path}"


def _atoi(text):
    return int(text) if text.isdigit() else text


def _natural_keys(text):
    """
    alist.sort(key=natural_keys) sorts in human order
    http://nedbatchelder.com/blog/200712/human_sorting.html
    https://stackoverflow.com/questions/5967500/how-to-correctly-sort-a-string-with-a-number-inside
    """
    return [ _atoi(c) for c in re.split(r'(\d+)', text) ]


def merge_jsons(m_jsons: List[Dict[Any, Any]]) -> Dict[Any, Any]:
    return reduce(lambda res, x: res | x, m_jsons, {})    


def unix_to_date(timestamp: str) -> datetime:
    """
    Wrapper of datetime function to convert strings containing a 
    unix timestamp to datetime format
    """
    try:
        return datetime.fromtimestamp(int(timestamp))
    except ValueError:
        print(f"Invalid timestamp {timestamp}")



def get_usage_data() -> Iterator[Dict[str, Dict[str, List[int]]]]:
    """
    Returns a generator to iterate over the available usage data
    """
    # sort files by creation order, represented by the name numbering
    files =[f"{DATA_FOLDER}/{file}" 
        for file in os.listdir(DATA_FOLDER) if file.endswith(".gz")]
    files.sort(key=_natural_keys, reverse=True)

    # load files from newest to older
    for file in files:
        print(file)
        try:
            with tarfile.open(file) as tar:
                for m in tar.getmembers():
                    data = json.loads(tar.extractfile(m).read())

                    # we only cara about the "Us Bytes" and "Ds Bytes" keys
                    targets = ["Us Bytes", "Ds Bytes"]
                    data = {date: {key: [int(i) for i in items] 
                        for key, items in data[date].items() if key in targets}
                            for date in data}
                    
                    yield data
        except Exception as e:
            print(e)
            continue


def get_uptime_data() -> Iterator[Dict[str, Dict[str, List[int]]]]:
    """
    Returns a generator to iterate over the available uptime data
    """
    # sort files by creation order, represented by the name numbering
    files =[f"{DATA_FOLDER}/{file}" 
        for file in os.listdir(DATA_FOLDER) if file.endswith(".gz")]
    files.sort(key=_natural_keys, reverse=True)

    # load files from newest to older
    for file in files:
        try:
            with tarfile.open(file) as tar:
                for m in tar.getmembers():
                    data = json.loads(tar.extractfile(m).read())

                    # we only cara about the "Us Bytes" and "Ds Bytes" keys
                    targets = ["Room", "MAC", "Online"]
                    data = {date: {key: items
                        for key, items in data[date].items() if key in targets}
                            for date in data}
                    
                    yield data
        except Exception as e:
            print(e)
            continue


def get_upto_nth_usage_data(n: int) -> Iterator[Dict[str, Dict[str, List[int]]]]:
    """
    Returns the usage data up to the nth day
    """
    usage_data = get_usage_data()
    now = datetime.now()
    for data in usage_data:
        end_data = unix_to_date(list(data.keys())[-1])
        # if the difference is bigger than 7 days, stop iterating
        if (now - end_data).days >= n:
            break
        print(end_data)
        yield data



def get_last_day_usage_data() -> Iterator[Dict[str, Dict[str, List[int]]]]:
    """
    Returns a generator to iterate over the last day available usage data
    """
    return get_upto_nth_usage_data(1)


def get_last_week_usage_data() -> Iterator[Dict[str, Dict[str, List[int]]]]:
    """
    Returns a generator to iterate over the last week available usage data
    """
    return get_upto_nth_usage_data(7)


def is_up_value_different(x1: str | int, x2: str | int):
    if type(x1) == type(x2):
        if type(x1) == int: return False
        return x1[2:] != x2[2:]
    return True


if __name__ == "__main__":
    data = get_uptime_data()
    d = next(data)
    
    import numpy as np

    keys = list(d.keys())
    values = list(d.values())
    diffs = []
    for i in range(1, len(values)):
        mac_last = values[i-1]["MAC"]
        mac = values[i]["MAC"]
        diff = [is_up_value_different(mac[j], mac_last[j]) for j in range(len(mac))]
        diffs.append(diff)
    diffs = np.array(diffs)

    import matplotlib.pyplot as plt

    s = diffs.sum(axis=0) / 2
    x = [2 * i for i in range(len(s))]
    labels = np.array(d[keys[0]]["Room"])
    idx = labels.argsort()

    plt.figure(figsize=(20,5), dpi=200)
    plt.bar(x, s[idx])
    plt.grid(True)
    plt.xticks(x, labels[idx], fontsize=5, rotation=90)


# %%
