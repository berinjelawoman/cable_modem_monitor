#%%
import re  
import pandas as pd
from functools import reduce

from typing import *


with open("output.txt") as f:
    text = f.readlines()


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
    return [re.split(r'\s{2,}', t) for t in text[start_index+1:end_index]]


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
    


# %%
config_out = get_config_output(text)

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

config_df = pd.DataFrame(config_out[1:], columns=config_out[0])

# the last character is a whitespace for some reason
cm_df = pd.DataFrame(cm_out[1:], columns=cm_out[0][:-1])[cm_targets]

phy_df = pd.DataFrame(phy_out[1:], columns=phy_out[0])[phy_targets]
counters_df = pd.DataFrame(counters_out[1:], 
    columns=counters_out[0])[counters_targets]

# we need to change the CM Mac column to MAC Address
cpe_df = pd.DataFrame(cpe_out[1:], columns=cpe_out[0])[cpe_targets]
cpe_df.columns = ["MAC Address"] + cpe_targets[1:]
cpe_df = cpe_df.groupby(cpe_df["MAC Address"]).aggregate(lambda s: s.tolist())

# merge all dataframes into one
df = reduce(lambda res, df: res.merge(df, how="left", on="MAC Address"),
    [cm_df, phy_df, cpe_df, counters_df], config_df)

# %%
# to monitor the cable modems use the command 
# "ping <IP Address> -c 1 -s 0" inside the server
# ping returns the following:
# Success: code 0
# No reply: code 1
# Other errors: code 2
# can also use from python
# x=subprocess.call("ping 10.10.3.62 -c 1 -s 0".split(" "), stdout=subprocess.DEVNULL)
