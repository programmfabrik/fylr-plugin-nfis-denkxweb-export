// GET /api/v1/plugin/extension/nfis-denkxweb-export/export

const DenkxwebUtil = require('./DenkxwebUtil');

let info = {}
try {
    info = JSON.parse(process.argv[2])
} catch (e) {
    console.error(`Unable to parse argument <info>`, e)
    process.exit(1);
}

const query = info.request.query;
const fromDate = Array.isArray(query.fromDate) ? query.fromDate[0] : null // new Date(query.fromDate) : null;
const limit = Array.isArray(query.limit) ? Number.parseInt(query.limit[0]) : 1000;
const offset = Array.isArray(query.offset) ? Number.parseInt(query.offset[0]) : 0;
const accessToken = info.api_user_access_token;

const searchUrl = "http://fylr.localhost:8081/api/v1/search?pretty=0"
const baseSearchPayload = {
    "offset": offset,
    "limit": limit,
    "search": [
        {
            "__filter": "SearchTypeSelector",
            "type": "complex",
            "bool": "must",
            "search": [
                {
                    "bool": "should",
                    "type": "in",
                    "fields": [
                        "item._pool.pool._id"
                    ],
                    // "in": [1, 4, 5, 6, 7, 8, 16, 19, 43]
                    "in": []
                },
                {
                    "type": "complex",
                    "bool": "should",
                    "search": [
                        {
                            "bool": "must_not",
                            "type": "in",
                            "fields": ["_objecttype"],
                            "in": ["item"]
                        }
                    ]
                }
            ]
        },
    ],
    "format": "full",
    // "format": "long",
    "sort": [
        {
            "field": "_system_object_id",
            "order": "DESC",
            "_level": 0
        }
    ],
    "objecttypes": ["item"],
    "timezone": "Europe/Berlin"
}

const dateSearchFilter = {
    "__filter": "SearchInput",
    "type": "complex",
    "search": [
        {
            "bool": "must",
            "type": "complex",
            "search": [
                {
                    "type": "in",
                    "bool": "must",
                    "fields": ["_objecttype"],
                    "in": ["item"]
                },
                {
                    "type": "complex",
                    "bool": "must",
                    "search": [
                        { "type": "changelog_range", "user": null, "operation": null, "from": fromDate }
                    ]
                }
            ],
        }
    ]
}

function throwError(error, description) {
    console.log(JSON.stringify({
        "error": {
            "code": "error.validation",
            "statuscode": 400,
            "realm": "api",
            "error": error,
            "parameters": {},
            "description": description
        }
    }));
    process.exit(0);
}

function getConfigFromAPI() {
    return new Promise((resolve, reject) => {
        var url = 'http://fylr.localhost:8081/api/v1/config';
        fetch(url, {
            headers: {
                'Accept': 'application/json',
                "Authorization": "Bearer " + accessToken,
            },
        })
            .then(response => {
                if (response.ok) {
                    resolve(response.json());
                } else {
                    throwError("Fehler bei der Anfrage an /api/v1/plugin/ ", '');
                }
            })
            .catch(error => {
                console.log(error);
                throwError("Fehler bei der Anfrage an /api/v1/plugin ", '');
            });
    });
}

function getSessionInfoFromAPI() {
    return new Promise((resolve, reject) => {
        var url = 'http://fylr.localhost:8081/api/v1/user/session?access_token=' + accessToken
        fetch(url, {
            headers: {
                'Accept': 'application/json'
            },
        })
            .then(response => {
                if (response.ok) {
                    resolve(response.json());
                } else {
                    throwError("Fehler bei der Anfrage an /api/v1/user/session ", '');
                }
            })
            .catch(error => {
                console.log(error);
                throwError("Fehler bei der Anfrage an /api/v1/user/session ", '');
            });
    });
}

function getPoolsFromAPI() {
    return new Promise((resolve, reject) => {
        var url = 'http://fylr.localhost:8081/api/v1/pool';
        fetch(url, {
            headers: {
                'Accept': 'application/json',
                "Authorization": "Bearer " + accessToken,
            },
        })
            .then(response => {
                if (response.ok) {
                    resolve(response.json());
                } else {
                    throwError("Fehler bei der Anfrage an /api/v1/plugin/ ", '');
                }
            })
            .catch(error => {
                console.log(error);
                throwError("Fehler bei der Anfrage an /api/v1/plugin ", '');
            });
    });
}


async function main() {
    var payload = baseSearchPayload;
    const [config, sessionInfo, pools] = await Promise.all([
        getConfigFromAPI(),
        getSessionInfoFromAPI(),
        getPoolsFromAPI(),
    ])

    const pluginBaseConfig = sessionInfo.config.base.plugin['nfis-denkxweb-export'].config['nfis_denkxweb_export'];
    if (!pluginBaseConfig.enabled) [
        throwError("The endpoint is not activated.", '')
    ]

    // check, if user has systemright to use the validation-endpoint, else throw error
    let allowAccess = false;
    if (sessionInfo.system_rights?.['plugin.nfis-denkxweb-export.nfis_denkxweb_export']?.use_denkxweb_endpoint == true) {
        allowAccess = true;
    }
    if (sessionInfo.system_rights['system.root']) {
        allowAccess = true;
    }
    if (allowAccess == false) {
        throwError("Der User besitzt nicht das Systemrecht für die Nutzung des Monitoring-Endpoints", '');
    }

    const poolIds = [];
    pools.forEach(pool => {
        // system root pool is fine, but we don't want objects without pool or objects in the trash bin.
        if (pool.pool.reference && pool.pool.reference !== 'system:root') return;

        poolIds.push(pool.pool._id)
    })
    payload.search[0].search[0].in = poolIds;

    if (fromDate !== null) {
        payload.search.push(dateSearchFilter)
    }


    const nfisGeometryConfig = config?.plugin?.['custom-data-type-nfis-geometry']

    if (!nfisGeometryConfig) {
        throwError("custom-data-type-nfis-geometry Plugin coudld not be found.", '')
    }

    const geoserverUsername = nfisGeometryConfig.config.nfisGeoservices.geoserver_read_username
    const geoserverPassword = nfisGeometryConfig.config.nfisGeoservices.geoserver_read_password
    const geoserverAuth = btoa(geoserverUsername + ':' + geoserverPassword)

    const response = await fetch(searchUrl, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + accessToken,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    })

    const jsonResponse = await response.json();
    const objects = jsonResponse?.objects;

    const xml = await DenkxwebUtil.getXML(objects, accessToken, geoserverAuth);

    process.stdout.write(xml)
    // process.stdout.write(JSON.stringify(objects[1].item['_reverse_nested:objekt__bild:lk_objekt'], null, 2))
    // process.stdout.write(JSON.stringify(xml, null, 2))


    // process.stdout.write(JSON.stringify(
    //     {
    //         limit,
    //         offset,
    //         fromDate: fromDate,
    //         jsonResponse,
    //         foundObjects: jsonResponse.count,
    //         getXml: xml,
    //         // payload: payload,
    //         objects: objects
    //     },
    //     null,
    //     2
    // ))
}
main()



