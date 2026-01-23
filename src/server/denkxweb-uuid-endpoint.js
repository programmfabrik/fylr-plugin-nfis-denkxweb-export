// GET /api/v1/plugin/extension/nfis-denkxweb-export/id

const DenkxwebUtil = require('./DenkxwebUtil');

let info = {}
try {
    info = JSON.parse(process.argv[2])
} catch (e) {
    console.error(`Unable to parse argument <info>`, e)
    process.exit(1);
}

const query = info.request.query;
const uuid = Array.isArray(query.uuid) ? query.uuid[0] : null;
const accessToken = info.api_user_access_token;

const searchUrl = "http://fylr.localhost:8081/api/v1/search?pretty=0"
const baseSearchPayload = {
    "offset": 0,
    "limit": 1,
    "format": "full",
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
                        "flaeche._pool.pool._id",
                        "item._pool.pool._id"
                    ],
                    "in": []
                },
                {
                    "type": "complex",
                    "bool": "should",
                    "search": [
                        {
                            "bool": "must_not",
                            "type": "in",
                            "fields": [
                                "_objecttype"
                            ],
                            "in": [
                                "flaeche",
                                "item"
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "type": "complex",
            "__filter": "SearchInput",
            "search": [
                {
                    "type": "complex",
                    "search": [
                        {
                            "type": "in",
                            "bool": "must",
                            "fields": [
                                "_objecttype"
                            ],
                            "in": [
                                "item"
                            ]
                        },
                        {
                            "type": "in",
                            "bool": "must",
                            "fields": [
                                "_tags._id"
                            ],
                            "in": []
                        }
                    ],
                    "bool": "should"
                },
                {
                    "type": "complex",
                    "search": [
                        {
                            "type": "in",
                            "mode": "fulltext",
                            "bool": "must",
                            "phrase": false,
                            "fields": [
                                "flaeche.lk_dante_art.conceptURI"
                            ],
                            "in": [
                                "http://uri.gbv.de/terminology/nld_area_type/ccfbf900-5dbb-42d0-b5eb-cf4638ae85df",
                                "http://uri.gbv.de/terminology/nld_area_type/e7e42a17-b6d1-4ad5-a9c1-0b33ad65ff09",
                                "http://uri.gbv.de/terminology/nld_area_type/0d4cc26c-0a0d-4133-8ad5-bb73062a1206",
                                "http://uri.gbv.de/terminology/nld_area_type/63f7be4e-84a4-4dc7-9e44-ca680ad8e55a"
                            ]
                        }
                    ],
                    "bool": "should"
                }
            ]
        },
        {
            "type": "complex",
            "search": [
                {
                    "type": "in",
                    "fields": [
                        "_uuid"
                    ],
                    "in": [
                        uuid
                    ],
                    "bool": "should"
                }
            ],
            "bool": "must"
        }
    ],
    "sort": [
        {
            "field": "_system_object_id",
            // "order": "DESC",
            "order": "ASC",
            "_level": 0
        }
    ],
    "objecttypes": ["flaeche", "item"],
    "timezone": "Europe/Berlin"
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
    if (!uuid) {
        throwError("UUID is missing.", '');
    }


    var payload = baseSearchPayload;
    const [config, sessionInfo, pools] = await Promise.all([
        getConfigFromAPI(),
        getSessionInfoFromAPI(),
        getPoolsFromAPI(),
    ])

    // check, if user has systemright to use the validation-endpoint, else throw error
    let allowAccess = false;
    if (sessionInfo.system_rights?.['plugin.nfis-denkxweb-export.nfis_denkxweb_export']?.use_denkxweb_endpoint == true) {
        allowAccess = true;
    }
    if (sessionInfo.system_rights['system.root']) {
        allowAccess = true;
    }
    if (allowAccess == false) {
        throwError("Der User besitzt nicht das Systemrecht für die Nutzung des Denkxweb-Endpoints", '');
    }

    const pluginBaseConfigEnabled = sessionInfo.config.base.plugin['nfis-denkxweb-export'].config['nfis_denkxweb_export'];
    const pluginBaseConfigTagIds = sessionInfo.config.base.plugin['nfis-denkxweb-export'].config['nfis_tag_ids'];
    const pluginBaseConfigPoolIds = sessionInfo.config.base.plugin['nfis-denkxweb-export'].config['nfis_pool_ids'];
    if (!pluginBaseConfigEnabled.enabled) {
        throwError("The endpoint is not activated.", '')
    }
    if (
        !pluginBaseConfigTagIds.level_0 ||
        !pluginBaseConfigTagIds.level_1 ||
        !pluginBaseConfigTagIds.level_2 ||
        !pluginBaseConfigTagIds.level_3 ||
        !pluginBaseConfigTagIds.directory_object ||
        !pluginBaseConfigTagIds.not_directory_object ||
        !pluginBaseConfigTagIds.public ||
        !pluginBaseConfigTagIds.not_public
    ) {
        throwError("Tag-IDs not configured.", 'One or more tag ids are not set. An admin can set the tag ids in the base config for this plugin.')
    }

    const poolIdStrings = pluginBaseConfigPoolIds?.pool_ids?.split(',')
    if (!Array.isArray(poolIdStrings) || (poolIdStrings.length < 2 && poolIdStrings[0].length === 0)) {
        throwError("Pool-IDs not configured.", '');
    }

    const poolIds = []
    const topLevelPoolIDs = [];
    poolIdStrings.forEach(poolString => {
        const poolId = Number.parseInt(poolString)
        if (poolId && poolId !== NaN) {
            topLevelPoolIDs.push(poolId)
        }
    })
    // only use pools that have an ID in topLevelPoolIDs or that have such an ID in their path
    pools.forEach(pool => {
        // pool is top level pool
        if (topLevelPoolIDs.includes(pool.pool._id)) return poolIds.push(pool.pool._id)

        // check if pool is a sub pool of our top level pools
        pool._path.some(pathPool => {
            if (topLevelPoolIDs.includes(pathPool.pool._id)) {
                poolIds.push(pool.pool._id)
                return true
            }
        })
    })

    payload.search[0].search[0].in = poolIds;

    payload.search[1].search[0].search[1].in = [pluginBaseConfigTagIds.public];

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

    const objects = (await response.json())?.objects;

    const xml = await DenkxwebUtil.getXML(objects, {}, accessToken, geoserverAuth, pluginBaseConfigTagIds);

    process.stdout.write(xml)
}
main()