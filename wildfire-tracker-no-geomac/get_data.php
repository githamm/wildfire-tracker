<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);

#require 'vendor/autoload.php';

if (!function_exists('get_config')) {
    // Config contains non-repo environment and credentials information
    function get_config() {
        return json_decode(file_get_contents('../../configs/config_wildfires.json'),true);
    }
}

$url='https://opendata.arcgis.com/datasets/9838f79fb30941d2adde6710e9d6b0df_0.geojson';
$ch = curl_init();
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//curl_setopt($ch, CURLOPT_USERAGENT, 'rohit');
curl_setopt($ch, CURLOPT_URL, $url);
$result = curl_exec($ch);
curl_close($ch);
#$resultArray = json_decode($result);
echo "<pre>";
#print_r($resultArray);
print_r($result);

//file_put_contents('./wildfire_data.json', $result);

function ftp_json($file,$config) {
        $success = false;
        $connection = ftp_connect($config['ftp_server']);
        $login = ftp_login($connection,$config['ftp_user'],$config['ftp_pass']);
        if ($login) {
            ftp_pasv($connection, TRUE);
            if (!$chg_dir = ftp_chdir($connection,$config['ftp_path'])) {
                $error = 'Could not find directory!';
            }
            // $remotefiles = ftp_nlist($connection,'.');

            // $local_file = $file;
            // echo "saving this local file to extras ".$file;
            // $local_exists = file_exists($local_file);
            // $remote_exists = in_array($file, $remotefiles);
            // $bak_exists = in_array($file.'.bak', $remotefiles);
            ftp_close($connection);
            // if (isset($error)) {
            //     return array(false,$error);
            // } else {
            //     return array(true,'Success!');
            // }
        } else {
            return array(false,'Could not log in to FTP server.');
        }
    }
    $config = get_config();
    echo "<br><br>CHRIS config -".$config['ftp_server'];
    //save to file so users aren't hitting these API's and slowing down
    //$file = "wildfire.json";
    //$file2 = "bills_dp.json";
    //$currentMonth = date('m');
    // if ($currentMonth >= 6){
    //     $currentYear = date('Y', strtotime('+1 years'));
    // }else{
    //     $currentYear = date('Y');
    // }
    // $file3 = "bills-".$currentYear.".json";
    // $file4 = "bills_dp-".$currentYear.".json";
    // Open the file to get existing content
    //$current = file_get_contents($file);
    // Append a new person to the file
    //$current .= $body;
    file_put_contents('wildfire.json', $result);
    ftp_json($file,$config);
    // file_put_contents($file2, $customDPData);
    // ftp_json($file2,$config);
    // file_put_contents($file3, $answer);
    // ftp_json($file3,$config);
    // file_put_contents($file4, $customDPData);
    // ftp_json($file4,$config);