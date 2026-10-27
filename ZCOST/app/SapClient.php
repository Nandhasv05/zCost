<?php
/**
 * AUTHOR: NANDHAKUMAR SV 
 * LAST EDIT : 26/10/2026
 * DESC : Pure Live SAP OData Client - No local storage/database
 */
declare(strict_types=1);

namespace App;

class SapClient
{
    private array $config;

    public function __construct(?array $config = null)
    {
        if ($config === null) {
            $configFile = __DIR__ . '/../config/config.php';
            $this->config = file_exists($configFile) ? require $configFile : [];
        } else {
            $this->config = $config;
        }
    }

    /**
     * Normalize Vbeln
     */
    private function cleanVbeln(string $vbeln): string
    {
        return trim($vbeln);
    }

    /**
     * Normalize Posnr
     */
    private function cleanPosnr(string $posnr): string
    {
        $p = trim($posnr);
        if (is_numeric($p) && strlen($p) < 6) {
            $p = str_pad($p, 6, '0', STR_PAD_LEFT);
        }
        return $p;
    }

    /**
     * Fetch Costing Sheet directly from Live SAP OData (No Local Cache / No Local Database)
     */
    public function getCostSheet(string $vbeln = '3000008', string $posnr = '000010'): array
    {
        $vbelnClean = $this->cleanVbeln($vbeln);
        $posnrClean = $this->cleanPosnr($posnr);

        // Query Live SAP OData Service
        $baseUrl = rtrim($this->config['sap']['base_url'] ?? 'http://APP-PROD.evolvclothing.com:8000', '/');
        $service = $this->config['sap']['service'] ?? '/sap/opu/odata/sap/ZCOST_SRV/ZCOSTHSet';
        $expand = $this->config['defaults']['expand'] ?? 'to_Fabric,to_Trim,to_Special,to_Packing';

        $url = sprintf(
            "%s%s(Vbeln='%s',Posnr='%s')?\$expand=%s&\$format=json",
            $baseUrl,
            $service,
            urlencode($vbelnClean),
            urlencode($posnrClean),
            $expand
        );

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_USERPWD, ($this->config['sap']['username'] ?? 'APIUSER') . ':' . ($this->config['sap']['password'] ?? 'Api@321'));
        if (!empty($this->config['sap']['resolve'])) {
            curl_setopt($ch, CURLOPT_RESOLVE, $this->config['sap']['resolve']);
        }
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->config['sap']['timeout'] ?? 20);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: application/json',
            'Content-Type: application/json'
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response !== false && $httpCode === 200) {
            $decoded = json_decode((string)$response, true);
            if (isset($decoded['d']) && is_array($decoded['d'])) {
                return [
                    'success' => true,
                    'source' => 'LIVE_SAP',
                    'http_code' => $httpCode,
                    'url' => $url,
                    'timestamp' => date('Y-m-d H:i:s'),
                    'data' => $decoded['d']
                ];
            }
        }

        // Parse any error message returned from SAP
        $errorMessage = "Quotation master not found in live SAP for {$vbelnClean} (Item {$posnrClean})";
        if (!empty($response)) {
            $errDecoded = json_decode((string)$response, true);
            if (isset($errDecoded['error']['message']['value'])) {
                $errorMessage = $errDecoded['error']['message']['value'];
            }
        } elseif ($curlError) {
            $errorMessage = "Live SAP connection error: {$curlError}";
        }

        return [
            'success' => false,
            'not_found' => true,
            'source' => 'LIVE_SAP',
            'http_code' => $httpCode,
            'vbeln' => $vbelnClean,
            'posnr' => $posnrClean,
            'error' => $errorMessage,
            'data' => null
        ];
    }

    /** Header fields allowed by ZCOSTH metadata (UI-only fields like Kwmeng must not be sent). */
    private const HEADER_FIELDS = [
        'Vbeln', 'Posnr', 'Sellprice', 'Making', 'Overhead', 'Markup', 'Quota', 'Commision',
        'Nmachreq', 'Npeicbnd', 'Fincost', 'Cnv', 'Cnvf', 'Sam', 'Approve', 'Approvedby',
        'Zzall', 'Zwast', 'Uname', 'Udate', 'Utime', 'MarkupP', 'CommVal', 'AddCost',
        'Discount', 'Subtot',
    ];

    /**
     * Line fields per nav entity (from ZCOST_SRV $metadata).
     * Special (ZCOSTIS) has no Zsection / Zline / Slno — sending them causes "Property 'Zsection' is invalid".
     */
    private const LINE_FIELDS_BY_NAV = [
        // zcosti
        'to_Fabric' => [
            'Vbeln', 'Posnr', 'Zline', 'Item', 'Maktx', 'WidSiz', 'Net', 'Wste', 'Gross',
            'Curunit', 'Rate', 'Totalinr', 'Totalfr', 'Totalper', 'Convr', 'Fincost',
            'Fright', 'Purp', 'Duty', 'Slno', 'Zsection', 'Zdeli', 'Uname', 'Udate', 'Utime',
        ],
        // ZCOSTIT
        'to_Trim' => [
            'Vbeln', 'Posnr', 'Zline', 'Item', 'Maktx', 'WidSiz', 'Net', 'Wste', 'Gross',
            'Curunit', 'Rate', 'Totalinr', 'Totalfr', 'Totalper', 'Convr', 'Fright', 'Purp',
            'Duty', 'Fincost', 'Slno', 'Zsection', 'Zdeli', 'Uname', 'Udate', 'Utime',
        ],
        // ZCOSTIP
        'to_Packing' => [
            'Vbeln', 'Posnr', 'Zline', 'Item', 'Maktx', 'WidSiz', 'Net', 'Wste', 'Gross',
            'Curunit', 'Rate', 'Totalinr', 'Totalfr', 'Totalper', 'Convr', 'Fright', 'Purp',
            'Duty', 'Fincost', 'Slno', 'Zsection', 'Zdeli', 'Uname', 'Udate', 'Utime',
        ],
        // ZCOSTIS — no Zsection / Zline / Slno
        'to_Special' => [
            'Vbeln', 'Posnr', 'Item', 'Maktx', 'WidSiz', 'Net', 'Wste', 'Gross',
            'Curunit', 'Rate', 'Totalinr', 'Totalfr', 'Totalper', 'Convr', 'Fright', 'Purp',
            'Duty', 'Fincost', 'Zdeli', 'Uname', 'Udate', 'Utime',
        ],
    ];

    /**
     * Strip UI-only / unknown properties so SAP does not reject the deep insert
     * (e.g. "Property 'Kwmeng' is invalid", "Property 'Zsection' is invalid" on Special).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function sanitizeSavePayload(array $payload): array
    {
        if (isset($payload['d']) && is_array($payload['d'])) {
            $payload = $payload['d'];
        }

        $clean = [];
        foreach (self::HEADER_FIELDS as $field) {
            if (!array_key_exists($field, $payload)) {
                continue;
            }
            $value = $payload[$field];
            // Drop null deferred metadata blobs from GET responses
            if (is_array($value)) {
                continue;
            }
            $clean[$field] = $value;
        }

        // Ensure keys are normalized
        if (isset($clean['Vbeln'])) {
            $clean['Vbeln'] = $this->cleanVbeln((string)$clean['Vbeln']);
        }
        if (isset($clean['Posnr'])) {
            $clean['Posnr'] = $this->cleanPosnr((string)$clean['Posnr']);
        }
        if (isset($clean['Approve'])) {
            $clean['Approve'] = strtoupper(substr(trim((string)$clean['Approve']), 0, 1));
        }
        if (isset($clean['Approvedby'])) {
            $clean['Approvedby'] = substr(strtoupper(trim((string)$clean['Approvedby'])), 0, 12);
        }
        if (isset($clean['Cnv'])) {
            $clean['Cnv'] = substr(strtoupper(trim((string)$clean['Cnv'])), 0, 5);
        }

        foreach (self::LINE_FIELDS_BY_NAV as $navProp => $allowedFields) {
            $rows = $payload[$navProp]['results'] ?? null;
            if (!is_array($rows)) {
                continue;
            }
            $cleanRows = [];
            foreach ($rows as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $line = [];
                foreach ($allowedFields as $field) {
                    if (!array_key_exists($field, $row)) {
                        continue;
                    }
                    $value = $row[$field];
                    if (is_array($value)) {
                        continue;
                    }
                    $line[$field] = $value;
                }
                if (isset($line['WidSiz'])) {
                    $line['WidSiz'] = substr(trim((string)$line['WidSiz']), 0, 4);
                }
                if (isset($line['Item'])) {
                    $line['Item'] = substr(trim((string)$line['Item']), 0, 40);
                }
                if (isset($line['Maktx'])) {
                    $line['Maktx'] = substr(trim((string)$line['Maktx']), 0, 40);
                }
                if (isset($line['Curunit'])) {
                    $line['Curunit'] = substr(strtoupper(trim((string)$line['Curunit'])), 0, 5);
                }
                if (isset($clean['Vbeln'])) {
                    $line['Vbeln'] = $clean['Vbeln'];
                }
                if (isset($clean['Posnr'])) {
                    $line['Posnr'] = $clean['Posnr'];
                }
                $cleanRows[] = $line;
            }
            $clean[$navProp] = ['results' => $cleanRows];
        }

        return $clean;
    }

    /**
     * POST Costing Sheet directly to Live SAP OData service (No Local Cache / No Local Database)
     */
    public function saveCostSheet(array $payload): array
    {
        $baseUrl = rtrim($this->config['sap']['base_url'] ?? 'http://APP-PROD.evolvclothing.com:8000', '/');
        $serviceRoot = $baseUrl . '/sap/opu/odata/sap/ZCOST_SRV/';
        $postUrl = $baseUrl . '/sap/opu/odata/sap/ZCOST_SRV/ZCOSTHSet';

        // 1. Fetch CSRF token & cookies
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $serviceRoot);
        curl_setopt($ch, CURLOPT_USERPWD, ($this->config['sap']['username'] ?? 'APIUSER') . ':' . ($this->config['sap']['password'] ?? 'Api@321'));
        if (!empty($this->config['sap']['resolve'])) {
            curl_setopt($ch, CURLOPT_RESOLVE, $this->config['sap']['resolve']);
        }
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'X-CSRF-Token: Fetch',
            'Accept: application/json'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);

        $fetchResponse = curl_exec($ch);
        $fetchCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $fetchErr = curl_error($ch);
        curl_close($ch);

        $csrfToken = '';
        if (is_string($fetchResponse) && preg_match('/x-csrf-token:\s*([^\r\n]+)/i', $fetchResponse, $matches)) {
            $csrfToken = trim($matches[1]);
        }

        $cookies = [];
        if (is_string($fetchResponse) && preg_match_all('/Set-Cookie:\s*([^;]+)/i', $fetchResponse, $cookieMatches)) {
            $cookies = $cookieMatches[1];
        }
        $cookieHeader = implode('; ', $cookies);

        // Clean payload: only ZCOSTH + nav properties from $metadata (drops Kwmeng, Matnr, __metadata, …)
        $postData = $this->sanitizeSavePayload($payload);

        $jsonPayload = json_encode($postData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        // 2. Perform POST to ZCOSTHSet
        $postHeaders = [
            'Content-Type: application/json; charset=utf-8',
            'Accept: application/json'
        ];
        if (!empty($csrfToken)) {
            $postHeaders[] = 'X-CSRF-Token: ' . $csrfToken;
        }
        if (!empty($cookieHeader)) {
            $postHeaders[] = 'Cookie: ' . $cookieHeader;
        }

        $chPost = curl_init();
        curl_setopt($chPost, CURLOPT_URL, $postUrl);
        curl_setopt($chPost, CURLOPT_POST, true);
        curl_setopt($chPost, CURLOPT_POSTFIELDS, $jsonPayload);
        curl_setopt($chPost, CURLOPT_USERPWD, ($this->config['sap']['username'] ?? 'APIUSER') . ':' . ($this->config['sap']['password'] ?? 'Api@321'));
        if (!empty($this->config['sap']['resolve'])) {
            curl_setopt($chPost, CURLOPT_RESOLVE, $this->config['sap']['resolve']);
        }
        curl_setopt($chPost, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($chPost, CURLOPT_HTTPHEADER, $postHeaders);
        curl_setopt($chPost, CURLOPT_TIMEOUT, 25);
        curl_setopt($chPost, CURLOPT_CONNECTTIMEOUT, 6);

        $postRes = curl_exec($chPost);
        $postHttpCode = curl_getinfo($chPost, CURLINFO_HTTP_CODE);
        $postError = curl_error($chPost);
        curl_close($chPost);

        $requestMeta = [
            'method' => 'POST',
            'url' => $postUrl,
            'payload' => $postData,
            'csrf_method' => 'GET',
            'csrf_url' => $serviceRoot,
            'csrf_http_code' => (int)$fetchCode,
        ];

        if ($postHttpCode === 201 || $postHttpCode === 200) {
            $resDecoded = json_decode((string)$postRes, true);
            return array_merge($requestMeta, [
                'success' => true,
                'source' => 'LIVE_SAP',
                'http_code' => $postHttpCode,
                'message' => 'Successfully saved and posted to SAP ZCOST_SRV!',
                'data' => $resDecoded['d'] ?? $postData,
            ]);
        }

        // Check if SAP returned an error message in JSON
        $errorMessage = $postError ?: ($fetchErr ?: "SAP returned HTTP $postHttpCode");
        if (!empty($postRes)) {
            $errDecoded = json_decode((string)$postRes, true);
            if (isset($errDecoded['error']['message']['value'])) {
                $errorMessage = $errDecoded['error']['message']['value'];
            }
        }

        return array_merge($requestMeta, [
            'success' => false,
            'source' => 'LIVE_SAP',
            'http_code' => $postHttpCode,
            'sap_http_code' => $postHttpCode,
            'sap_error' => $errorMessage,
            'error' => $errorMessage,
            'message' => "SAP Save Failed: $errorMessage",
            'data' => $postData,
        ]);
    }

    /**
     * Create In-Memory Quotation Master Template (No Local Disk Storage)
     */
    public function createQuotationMaster(string $vbeln, string $posnr): array
    {
        $vbelnClean = $this->cleanVbeln($vbeln);
        $posnrClean = $this->cleanPosnr($posnr);

        $newMaster = [
            '_is_user_created' => true,
            'Vbeln' => $vbelnClean,
            'Posnr' => $posnrClean ?: '000010',
            'Matnr' => '',
            'Maktxh' => '',
            'Kwmeng' => '0.000',
            'Approve' => '',
            'Zzall' => 'X',
            'Cnv' => 'USD',
            'Cnvf' => '94.95',
            'Nmachreq' => 0,
            'Npeicbnd' => 0,
            'Sam' => '0.00',
            'Making' => '0.000',
            'Overhead' => '0.000',
            'Zwast' => '3.000',
            'Subtot' => '0.0000',
            'MarkupP' => '20.000',
            'Markup' => '0.00',
            'Commision' => '0.000',
            'CommVal' => '0.00',
            'AddCost' => '0.000',
            'Discount' => '0.000',
            'Sellprice' => '0.000',
            'Quota' => '0.000',
            'to_Fabric' => [
                'results' => []
            ],
            'to_Trim' => [
                'results' => []
            ],
            'to_Packing' => [
                'results' => []
            ],
            'to_Special' => [
                'results' => []
            ]
        ];

        return [
            'success' => true,
            'is_new' => true,
            'source' => 'LIVE_SAP',
            'note' => "Template created for {$vbelnClean} (In-Memory)",
            'http_code' => 200,
            'timestamp' => date('Y-m-d H:i:s'),
            'data' => $newMaster
        ];
    }
}
