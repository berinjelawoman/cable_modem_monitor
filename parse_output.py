#%%
import re  
import time
import json
import pandas as pd
from functools import reduce

from typing import *


def read_output() -> List[str]:
    with open("output.txt") as f:
        text = f.readlines()
        
    return text


def get_output(command: str, text: List[str]) -> List[str]:
    """
    Returns a list with the output of the given command, 
    split by white spaces. 
    Note that everything after the new line char is ignored.
    This is because it just happens that we do not care about 
    the information that is given after the first new line 
    of our inputs and we would get rid of it anyway
    """
    start_index = next(i for i, t in enumerate(text) 
        if command in t)
    end_index = next(i + start_index for i, t in enumerate(text[start_index+1:]) 
        if t=="\n")
    
    # split characters more than two whitespaces apart
    return [re.split(r'\s{2,}', t) for t in text[start_index+1:end_index+1]]


# A special function to the config output because it is structured a
# bit differently.
def get_config_output(text: List[str]) -> List[str]:
    """
    Returns a list of the mac addresses and the room they are in.
    """
    command = "show running-config | include desc"
    start_index = next(i for i, t in enumerate(text) 
        if command in t)
    end_index = next(i + start_index for i, t in enumerate(text[start_index+1:]) 
        if "#" in t)

    return [["MAC Address", "Room"]] + \
           [ [txt.split(" ")[2], txt.split(" ")[-2].replace('"', "")]
             for txt in text[start_index+1:end_index+1]]



def get_stats(text: List[str]) -> List[str]:
    """
    Returns a list containing the network usage statistics of each port
    """
    command = "show interface uplink statistics summary"

    start_index = next(i for i, t in enumerate(text) 
        if command in t)
    end_index = next(i + start_index for i, t in enumerate(text[start_index+1:]) 
        if "#" in t)
    
    # split characters more than two whitespaces apart
    return [re.split(r'\s{2,}', t) for t in text[start_index+1:end_index+1]]


def convert_values(df: pd.DataFrame) -> pd.DataFrame:
    """
    Converts Room, Number, Ds Bytes and Us Bytes to int
    Converts US_Pwr, US_SNR, DS_Pwr, DS_SNR to float
    """
    for column in ["Room", "Number", "Ds Bytes", "Us Bytes"]:
        df[column] = pd.to_numeric(df[column], 
            downcast="integer", errors="coerce")

    for column in ["US_Pwr", "US_SNR", "DS_Pwr", "DS_SNR"]:
        df[column] = pd.to_numeric(df[column], 
            downcast="float", errors="coerce")

    return df


def save_dfs(df: pd.DataFrame, stats_df: pd.DataFrame) -> None:
    """
    Merges the dataframe into a timestamped json of the usage history.
    """

    filename = "/var/www/monitor/test/files/df.json"
    filename_bk = "/var/www/monitor/test/files/df_bk.json"
    m_dict = {}
    now = int(time.time())
    m_dict[now] = { column: df[column].tolist() for column in df.columns }
    m_dict[now]["Usage"] = { column: stats_df[column].tolist() for column in stats_df.columns }

    try:
        with open(filename_bk) as f:
            data = json.load(f)

        data.update(m_dict)

    except FileNotFoundError:
        data = m_dict

    with open(filename, "w") as f:
        # keep only the 50 last records for the front end
        m_data = { key: data[key] for key in list(data.keys())[-50:] }
        json.dump(m_data, f)

    # keep everything for the backup
    with open(filename_bk, "w") as f:
        json.dump(data, f)


def main():
    """
    Runs the expect script and captures all its information.
    """
    text = read_output()
    config_out = get_config_output(text)
    stats_out = get_stats(text)

    cm_out = get_output("show cable modem", text)
    cpe_out = get_output("show cpe all", text)
    phy_out = get_output("show cable modem phy", text)
    counters_out = get_output("show cable modem counters", text)

    # the second element of these outputs is just a continuation
    # of the columns titles
    del cm_out[1]
    del phy_out[1]

    cm_targets = ["MAC Address", "IP Address", "MAC", "Online", "Number"]
    cpe_targets = ["CM MAC", "CPE IP Address"]
    phy_targets = ["MAC Address", "US_Pwr", "US_SNR", "DS_Pwr", "DS_SNR"]
    counters_targets = ["MAC Address", "Ds Bytes", "Us Bytes"]
    stats_targets = [" Port", "CurrentTx(kbps)", "CurrentRx(kbps)", "MaxTx(kbps)", "MaxRx(kbps)"]

    config_df = pd.DataFrame(config_out[1:], columns=config_out[0])

    # the last character is a whitespace for some reason
    cm_df = pd.DataFrame(cm_out[1:], columns=cm_out[0][:-1])[cm_targets]

    phy_df = pd.DataFrame(phy_out[1:], columns=phy_out[0])[phy_targets]
    counters_df = pd.DataFrame(counters_out[1:], 
        columns=counters_out[0])[counters_targets]

    stats_df = pd.DataFrame(stats_out[1:], columns=stats_out[0])[stats_targets]
    stats_df = stats_df.rename(columns={" Port" : "Port"})

    # we need to change the CM Mac column to MAC Address
    cpe_df = pd.DataFrame(cpe_out[1:], columns=cpe_out[0])[cpe_targets]
    cpe_df.columns = ["MAC Address"] + cpe_targets[1:]
    cpe_df = cpe_df.groupby(cpe_df["MAC Address"]).aggregate(lambda s: s.tolist())

    # merge all dataframes into one
    df = reduce(lambda res, df: res.merge(df, how="left", on="MAC Address"),
        [cm_df, phy_df, cpe_df, counters_df], config_df)
    df = convert_values(df)
    df = df.fillna(-1)

    save_dfs(df, stats_df)


#%%
if __name__ == "__main__":
    main()

# %%
# to monitor the cable modems use the command 
# "ping <IP Address> -c 1 -s 0" inside the server
# ping returns the following:
# Success: code 0
# No reply: code 1
# Other errors: code 2
# can also use from python
# x=subprocess.call("ping 10.10.3.62 -c 1 -s 0".split(" "), stdout=subprocess.DEVNULL)
