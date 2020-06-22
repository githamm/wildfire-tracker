<?php

if (!function_exists('get_config')) {
    // Config contains non-repo environment and credentials information
    function get_config() {
        return json_decode(file_get_contents('config.json'),true);
    }
}

$wildfireJson = file_get_contents("https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Active_Fires/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson");

    function ftp_json($file,$config) {
        $success = false;
        $connection = ftp_connect($config['ftp_server']);
        $login = ftp_login($connection,$config['ftp_user'],$config['ftp_pass']);
        if ($login) {
            ftp_pasv($connection, TRUE);
            if (!$chg_dir = ftp_chdir($connection,$config['ftp_path'])) {
                $error = 'Could not find directory!';
            }
            $remotefiles = ftp_nlist($connection,'.');

            $local_file = $file;
            echo "saving this local file to extras ".$file;
            $local_exists = file_exists($local_file);
            $remote_exists = in_array($file, $remotefiles);
            $bak_exists = in_array($file.'.bak', $remotefiles);
//            if ($remote_exists) {
//                if ($bak_exists) {
//                    $bak_exists = ftp_delete($connection,$file.'.bak');
//                }
//                $rename = ftp_rename($connection,$file,$file.'.bak');
//            } else {
//                $rename = false;
//            }
            //if ((!$remote_exists || !$rename=false) && $local_exists) {
                echo "<br><br>inside ftp_put";
                $put = ftp_put($connection, $file, $local_file, FTP_BINARY);
                if (!$put) {
                    $error = 'FTP of '.$file.' to '.$config['ftp_path'].' failed.';
                }
            //}
            ftp_close($connection);
            if (isset($error)) {
                return array(false,$error);
            } else {
                return array(true,'Success!');
            }
        } else {
            return array(false,'Could not log in to FTP server.');
        }
    }
    $config = get_config();
    echo "<br><br>CHRIS config -".$config['ftp_server'];
    //save to file so users aren't hitting these API's and slowing down
    $file = "wildfires.json";
    // $file2 = "bills_dp.json";
    // $currentMonth = date('m');
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
    file_put_contents($file, $wildfireJson);
    ftp_json($file,$config);
    // file_put_contents($file2, $customDPData);
    // ftp_json($file2,$config);
    // file_put_contents($file3, $answer);
    // ftp_json($file3,$config);
    // file_put_contents($file4, $customDPData);
    // ftp_json($file4,$config);





//}//end hptt request function

//print_r($customDataArray);


//
//
//$billData = json_decode($body, true);
//
//foreach($billData as $item) { //foreach element in $arr
//    echo $item["b2"]["title"]."<br>";
//    echo $item["b2"]["actions"][0]["description"]."<br>";
//}

//echo $body;