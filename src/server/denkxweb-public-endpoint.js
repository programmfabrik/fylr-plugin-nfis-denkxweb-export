// GET /api/v1/plugin/extension/nfis-denkxweb-export/public
const { Readable } = require('stream');
const { parser } = require('stream-json');
const { pick } = require('stream-json/filters/Pick');
const { ignore } = require('stream-json/filters/Ignore');
const { streamValues } = require('stream-json/streamers/StreamValues');
const { streamArray } = require('stream-json/streamers/StreamArray');

const DenkxwebUtil = require('./DenkxwebUtil');

let info = {}
try {
    info = JSON.parse(process.argv[2])
} catch (e) {
    console.error(`Unable to parse argument <info>`, e)
    process.exit(1);
}

const query = info.request.query;
const limit = Array.isArray(query.limit) ? Number.parseInt(query.limit[0]) : 1000;
const offset = Array.isArray(query.offset) ? Number.parseInt(query.offset[0]) : 0;
const accessToken = info.api_user_access_token;

const searchUrl = "http://fylr.localhost:8081/api/v1/search?pretty=0"
const baseSearchPayload = {
    "offset": offset,
    "limit": limit,
    "format": "standard",
    // "format": "long",
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
    var payload = baseSearchPayload;
    const [sessionInfo, pools] = await Promise.all([
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
    if (!pluginBaseConfigTagIds.public) {
        throwError("Public Tag-IDs not configured.", 'Tag id for public tag is not set. An admin can set the tag ids in the base config for this plugin.')
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

    // process.stdout.write(JSON.stringify(payload, null, 2))

    const response = await fetch(searchUrl, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + accessToken,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    })

    let objects = [];
    let total = 0;
    let offset = 0;
    let limit = 0;


    // process.stdout.write(await response.clone().text())
    const [bodyMeta, bodyObjects] = response.body.tee();

    const metaDone = new Promise((resolve, reject) => {
        Readable.fromWeb(bodyMeta)
            .pipe(parser())
            .pipe(ignore({ filter: "objects" }))
            .pipe(streamValues())
            .once("data", ({ value }) => {
                // value is the full root object (with objects removed/replaced)
                ({ count: total, offset, limit } = value);
            })
            .on("end", resolve)
            .on("error", reject);
    });

    const objectsDone = new Promise((resolve, reject) => {
        Readable.fromWeb(bodyObjects)
            .pipe(parser())
            .pipe(pick({ filter: "objects" }))
            .pipe(streamArray())
            .on("data", ({ value }) => objects.push(value))
            .on("end", resolve)
            .on("error", reject);
    });

    await Promise.all([metaDone, objectsDone]);

    // console.log({ total, offset, limit, objectsCount: objects.length });

    const responseData = {
        count: objects?.length || 0,
        total: total,
        offset: offset,
        limit: limit,
        data: objects.map((object) => object._uuid),
    }

    process.stdout.write(JSON.stringify(responseData, null, 2))

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



