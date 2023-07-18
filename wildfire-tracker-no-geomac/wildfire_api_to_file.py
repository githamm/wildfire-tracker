import requests
r = requests.get('https://opendata.arcgis.com/datasets/9838f79fb30941d2adde6710e9d6b0df_0.geojson')

with open('wildfire_data.json','w') as fd:
    fd.write(r.text)