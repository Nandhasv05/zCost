<?php
declare(strict_types=1);

/**
 * SAP ZCOST Module Configuration
 * Module: ZCOST
 * Endpoint: /sap/opu/odata/sap/ZCOST_SRV/ZCOSTHSet
 */

return [
    'app_name'     => 'SAP Garment Costing Sheet',
    'app_subtitle' => 'ZCOST_SRV OData Explorer & Real-Time Cost Analysis',

    'sap' => [
        'base_url'    => 'http://APP-PROD.evolvclothing.com:8000',
        'service'     => '/sap/opu/odata/sap/ZCOST_SRV/ZCOSTHSet',
        'username'    => 'APIUSER',
        'password'    => 'Api@321',
        'resolve'     => [
            'APP-PROD.evolvclothing.com:8000:10.103.10.18',
            'app-prod.evolvclothing.com:8000:10.103.10.18',
        ],
        'timeout'     => 30,
    ],

    'defaults' => [
        'vbeln' => '0022002311',
        'posnr' => '000020',
        'expand' => 'to_Fabric,to_Trim,to_Special,to_Packing',
    ],
];
