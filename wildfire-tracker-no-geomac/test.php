<?php
// $jsonString = file_get_contents("https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Active_Fires/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson");
// $myFile = "testFile.json";
// file_put_contents($myFile,$jsonString);
// echo '{ "success": true }';

$gm_file_two = implode(file('https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Active_Fires/FeatureServer/0/query?outFields=DailyAcres,FireCause,FireDiscoveryDateTime,IncidentName,IncidentTypeCategory,ModifiedOnDateTime,PercentContained,POOCity,POOCounty,POOLandownerCategory,POOState,ContainmentDateTime,FireMgmtComplexity,TotalIncidentPersonnel&where=1%3D1&f=geojson'));
$gm_array_two = json_decode($gm_file_two, TRUE);
echo $gm_array_two;
?>