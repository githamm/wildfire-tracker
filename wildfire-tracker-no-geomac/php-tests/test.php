<?php
// $jsonString = file_get_contents("https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Active_Fires/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson");
// $myFile = "testFile.json";
// file_put_contents($myFile,$jsonString);
// echo '{ "success": true }';
$gm_file_one = implode(file('https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Active_Fires/FeatureServer/0/query?outFields=DailyAcres,FireCause,FireDiscoveryDateTime,IncidentName,IncidentTypeCategory,ModifiedOnDateTime,PercentContained,POOCity,POOCounty,POOLandownerCategory,POOState,ContainmentDateTime,FireMgmtComplexity,TotalIncidentPersonnel&where=1%3D1&f=geojson'));
$gm_array_one = json_decode($gm_file_one, TRUE);
$features1 = $gm_array_one;
$gm_file_two = implode(file('test_php.geojson'));
$gm_array_two = json_decode($gm_file_two, TRUE);
$features2 = $gm_array_two;
// $fullDiff = array_merge(array_diff($features1, $features2), array_diff($features2, $features1));
// $fullDiff = array_diff($features2, $features1);
//echo '<pre>'; print_r($fullDiff); echo '</pre>';

// $featuresArray1 = $json->polygon->geometry->coordinates[0];
$featuresArray1 = $features1['features'];
$featuresArray2 = $features2['features'];

$testArray1 = array();
$testArray2 = array();

// foreach($featuresArray1 as $item){
//     array_push($testArray1, [$item['geometry']['coordinates'][0], $item['geometry']['coordinates'][1], 'DailyAcres' => $item['properties']['DailyAcres'], 'FireCause' => $item['properties']['FireCause'], 'IncidentName' => $item['properties']['IncidentName']]);
// }

// foreach($featuresArray2 as $item){
//     array_push($testArray2, [$item['geometry']['coordinates'][0], $item['geometry']['coordinates'][1], 'DailyAcres' => $item['properties']['DailyAcres'], 'FireCause' => $item['properties']['FireCause'], 'IncidentName' => $item['properties']['IncidentName']]);

foreach($featuresArray1 as $item){	
	array_push($testArray1, ['IncidentName' => $item['properties']['IncidentName']]);
}

foreach($featuresArray2 as $item){
	array_push($testArray2, ['IncidentName' => $item['properties']['IncidentName']]);
}

// foreach($featuresArray1 as $item){

//     array_push($testArray1, [$item['geometry']['coordinates'][0], $item['geometry']['coordinates'][1], $item['properties']['DailyAcres'], $item['properties']['FireCause'],$item['properties']['IncidentName']]);
// }

// foreach($featuresArray2 as $item){

//     array_push($testArray2, [$item['geometry']['coordinates'][0], $item['geometry']['coordinates'][1], $item['properties']['DailyAcres'], $item['properties']['FireCause'], $item['properties']['IncidentName']]);
    
// }

$arrayDiff = array_map('unserialize',
    array_diff(array_map('serialize', $testArray2), array_map('serialize', $testArray1)));

// $array1 = Array('fire','cat', 'goat', 'llama', 'egret');
// $array2 = Array('fire','cat','dog', 'egret');
// $fullDiff = array_merge(array_diff($testArray1, $testArray2), array_diff($testArray2, $testArray1));
// $arrayDiff = array_diff($array2, $array1);
// $arrayDiff = array_diff($gm_array_one,$gm_array_two);
echo '<pre>'; print_r($arrayDiff); echo '</pre>';
// echo count($features1['features']);
?>