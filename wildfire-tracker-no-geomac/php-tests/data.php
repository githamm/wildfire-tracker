<?php

//sheet id
//1tvNGY4UeD_lF2d-iDKTSnrRVRHN0JQhRA2vloIqXgAY

//data colorado
//key id
// 88hg5cvut8slil4ck8k3ab46u
//key secret
// 4tl6vc9fzrlg27zvy4sf0gq2vsh3se8o5ew9xq909l6r8464ky
//app token
// mkcSDnKyvcb819lPkRuoVHTg3

//key
// 4/uAE7V5hk4U_AWCzpfV2SYxBFxFa_RPdhO--fWbX2YwrJmLSeDGDVbP4

error_reporting(E_ALL);
ini_set('display_errors', 1);

require 'vendor/autoload.php';

if (!function_exists('get_config')) {
    // Config contains non-repo environment and credentials information
    function get_config() {
        return json_decode(file_get_contents('config.json'),true);
    }
}

////guzzle libraries
use GuzzleHttp\Client;
use GuzzleHttp\Promise;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\RequestOptions;

$client = new Google_Client();
$client->setApplicationName("bill-tracker");
$client->setDeveloperKey("AIzaSyClcg6kvp0Izb8vbcd-x69Ja8e99J2RV2s");

$service = new Google_Service_Sheets($client);
//
// Prints the names and majors of students in a sample spreadsheet:
// https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
//$spreadsheetId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
$spreadsheetId = '1tvNGY4UeD_lF2d-iDKTSnrRVRHN0JQhRA2vloIqXgAY';
$range = 'Sheet1!A1:H29';
$response = $service->spreadsheets_values->get($spreadsheetId, $range);
$values = $response->getValues();

//
//print_r($values);
//echo "<br><br>";
$i = 0;
$billCount = 1;
$billString = '{';
$billLength = count($values);
$customDPData = array();
if (empty($values)) {
    print "No data found.\n";
} else {
    foreach ($values as $row) {
        $i++;
        if($i <= 1) continue;
        //put google sheet data into a seperate array that will get put into a different json file
        $customDPData["data"]["Bill$billCount"]["name"] .= $row[2];
        //$customDPData["data"]["Bill$billCount"]["desc"] .= $row[3];
        $customDPData["data"]["Bill$billCount"]["links"] .= $row[4];
        $customDPData["data"]["Bill$billCount"]["stalled"] .= $row[5];
        $customDPData["data"]["Bill$billCount"]["smalldesc"] .= $row[6];
        $customDPData["data"]["Bill$billCount"]["largedesc"] .= $row[7];



        //create query for open states from google sheet
        if ($row[0] != ""){
            $billString .= 'b'.$billCount.': bill(openstatesUrl: "'.$row[0].'") { title identifier actions { description date } sponsorships { name entityType organization { id } person { id } } sources { url } updatedAt }';
        }
        $billCount++;
    }

}

$customDPData = json_encode($customDPData);
//$customDataArray = json_encode($customDataArray);
//print_r($customDPData);
//echo "<br>".$billString;

//$client = new \GuzzleHttp\Client;

    hitOpenStates($billString,$customDPData);



//echo $body;
//echo "<br><br>";
//{bill(jurisdiction: "Colorado", session: "2019A", identifier: "SB 19-107"){titleactions { description date } sources { url } createdAt updatedAt } }

//$billLink = 'https://openstates.org/graphql?query='.urlencode($body);

//correct format test query
//$body = '{"query":"{people(first:3){edges{node{name}}}}"}';
//works
//$body = '{"query":"{bill(openstatesUrl: \"https://openstates.org/co/bills/2019A/SB19-107/\") { title identifier actions { description date } sponsorships { name entityType organization { id } person { id } } sources { url } updatedAt } }"}';



//$body = '{"query":"{b1: bill(openstatesUrl: \"https://openstates.org/co/bills/2019A/SB19-107/\") { title identifier actions { description date } sponsorships { name entityType organization { id } person { id } } sources { url } updatedAt }b2: bill(openstatesUrl: \"https://openstates.org/co/bills/2019A/SB19-107/\") { title identifier actions { description date } sponsorships { name entityType organization { id } person { id } } sources { url } updatedAt } }"}';


//from code
//$body = '{"query":"{b1: bill(openstatesUrl: \"https://openstates.org/co/bills/2019A/SB19-204/\") { title identifier actions { description date } sponsorships { name entityType organization { id } person { id } } sources { url } updatedAt }b2: bill(openstatesUrl: \"https://openstates.org/co/bills/2019A/SB19-107/\") { title identifier actions { description date } sponsorships { name entityType organization { id } person { id } } sources { url } updatedAt }}"}';

//echo $body;
//echo "<br><br>";
//$billLink = 'https://postb.in/1577737339797-0947535871528';
//$billLink = 'https://openstates.org/graphql';

//$request = new Request('POST', $billLink, ['body' => '{"query":"{user(id:902){id,username,DOB}}"}']);
//$response = $client->send($request);
//$body = $response->getBody();
function hitOpenStates($billString,$customDPData) {

    $client = new \GuzzleHttp\Client(['headers' => ['X-API-KEY' => '9024b54c-75b2-4d2f-a559-ca03b08d2748','Content-Type' => 'application/json']]);

    echo "<br><br>inside curl function<br><br>";

    $curl = curl_init();

    echo "<br><br>";
    echo "Generated<br>";
    $generateString  = (String) $billString.'}';
    //$body_generated = filter_var($generateString, FILTER_SANITIZE_STRING);
    //$body_generated = trim($body_generated);
    print_r($generateString);
    echo "<br>--------------<br>";
    echo "<br>--------------<br>";

    //echo $body_generated;
    echo "<br>--------------<br>";
   // $body = '{b1: bill(openstatesUrl: "https://openstates.org/co/bills/2019A/SB19-204/") { title identifier actions { description date } sponsorships { name entityType organization { id } person { id } } sources { url } updatedAt }b2: bill(openstatesUrl: "https://openstates.org/co/bills/2019A/SB19-107/") { title identifier actions { description date } sponsorships { name entityType organization { id } person { id } } sources { url } updatedAt }}';
    $body = str_replace(array("\r\n","\r"),"",$body);
//application/x-www-form-urlencoded
    echo $body_generated;
    echo "<br><br><br><br>";
    $billLink = 'https://openstates.org/graphql';
    //$billLink = 'https://postb.in/1577839618974-2874524495564';


//$request = new Request('post', $billLink, ['body' => "hey",]);
    //$request = new Request('POST', $billLink, ['json' => $body_generated]);
    //$response = $client->send($request);


    $response = $client->post($billLink, [
        GuzzleHttp\RequestOptions::JSON => ["query" => $generateString]
    ]);
    $answer = $response->getBody();
    echo $answer;
//    curl_setopt_array($curl, array(
//        CURLOPT_URL => "https://openstates.org/graphql",
//        CURLOPT_RETURNTRANSFER => true,
//        CURLOPT_ENCODING => "",
//        CURLOPT_MAXREDIRS => 10,
//        CURLOPT_TIMEOUT => 30,
//        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
//        //CURLOPT_CUSTOMREQUEST => "POST",
//        //CURLOPT_POSTFIELDS => "{\"query\":\"{b1: bill(openstatesUrl: \\\"https://openstates.org/co/bills/2019A/SB19-204/\\\") { title identifier actions { description date } sponsorships { name entityType organization { id } person { id } } sources { url } updatedAt }b2: bill(openstatesUrl: \\\"https://openstates.org/co/bills/2019A/SB19-107/\\\") { title identifier actions { description date } sponsorships { name entityType organization { id } person { id } } sources { url } updatedAt }}\"}",
//        CURLOPT_POSTFIELDS => $body_generated,
//        CURLOPT_HTTPHEADER => array(
//            "Accept: */*",
//            "Accept-Encoding: gzip, deflate",
//            "Cache-Control: no-cache",
//            "Connection: keep-alive",
//            "Content-Length: 452",
//            "Content-Type: application/json",
//            "Cookie: csrftoken=dWRxftUjqD5BmYvz6o2Z7qG7hMxU3pO7KrqK5a2EV64HIhj0aUZZzPezNLE6vJ8n",
//            "Host: openstates.org",
//            "Postman-Token: d6ac3e81-08a2-4609-a36b-b1475dc407e2,a4481a5b-63ff-4df5-8a8b-376b36ce066d",
//            "User-Agent: PostmanRuntime/7.20.1",
//            "X-API-KEY: 9024b54c-75b2-4d2f-a559-ca03b08d2748",
//            "cache-control: no-cache"
//        ),
//    ));


    //$response = curl_exec($curl);
    //$err = curl_error($curl);
    //print_r($err);
    //curl_close($curl);

//    if ($err) {
//        echo "cURL Error #:" . $err;
//    } else {
//        echo $response;
//    }
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
    $file = "bills.json";
    $file2 = "bills_dp.json";
    $currentMonth = date('m');
    if ($currentMonth >= 6){
        $currentYear = date('Y', strtotime('+1 years'));
    }else{
        $currentYear = date('Y');
    }
    $file3 = "bills-".$currentYear.".json";
    $file4 = "bills_dp-".$currentYear.".json";
    // Open the file to get existing content
    //$current = file_get_contents($file);
    // Append a new person to the file
    //$current .= $body;
    file_put_contents($file, $answer);
    ftp_json($file,$config);
    file_put_contents($file2, $customDPData);
    ftp_json($file2,$config);
    file_put_contents($file3, $answer);
    ftp_json($file3,$config);
    file_put_contents($file4, $customDPData);
    ftp_json($file4,$config);





}//end hptt request function

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