const { pointOnFeature } = require('@turf/point-on-feature');
const { create } = require('xmlbuilder2');

const LOCAL_TZ = "Europe/Berlin";
const TAG_IDS = {
    LEVEL_0: 2,
    LEVEL_1: 5,
    LEVEL_2: 3,
    LEVEL_3: 4,
    DIRECTORY_OBJECT: 1,
    NOT_DIRECTORY_OBJECT: 20,
    PUBLIC: 6,
    NOT_PUBLIC: 7,
}
const CURRENT_ADDRESS_URI = 'http://uri.gbv.de/terminology/nld_address_type/9ee12d18-d708-4ccb-b7fc-8a64b6e3d445'
const OBJECT_DESCRIPTION_URI = 'http://uri.gbv.de/terminology/nld_description_type/3000dc03-7089-45ad-8f62-170c34d3f8b8'
const REASON_DESCRIPTION_URI = 'http://uri.gbv.de/terminology/nld_description_type/cc0e8011-29f5-41af-8d14-c05e3652654e'
const THEME_DESCRIPTION_URI = 'http://uri.gbv.de/terminology/nld_description_type/6aa5fe48-287f-4e9e-9112-94c4c3a9b5fb'
const DESIGNATION_EVENT_TYPE_URI = 'http://uri.gbv.de/terminology/object_related_event/978eb685-12d0-45d2-ac64-77bc64b7de0b'
const CREATION_EVENT_TYPE_URI = 'http://uri.gbv.de/terminology/object_related_event/4d52f1c2-2d21-44cb-8097-63d5ac7c1d40'
const PARENT_OBJECT_TYPE_URI = 'http://uri.gbv.de/terminology/nld_object_category/4c76e057-b997-450d-b82f-e7004f8baff9'
const LITERATURE_REFERENCE_TYPE_URI = 'http://uri.gbv.de/terminology/controlling_literature_weblink/a868c2fa-117a-4899-bb03-034eff5b4695'
const INTERNET_REFERENCE_TYPE_URI = 'http://uri.gbv.de/terminology/controlling_literature_weblink/df2a8de5-634a-49fe-a158-e88d224e73e9'
const ADABWEB_IDENTIFIER_URI = 'http://uri.gbv.de/terminology/nld_identifier_type/94d0d141-7f23-4248-84eb-58ef3c70426f'

// themes map: conceptURI => label
const THEMES_MAP = {}
// group map: system_object_id of the group => group object
const GROUP_MAP = {}
// group member map: system_object_id of the group => array of group members
const GROUP_MEMBER_MAP = {}
// poylgon map: ouuid => poylgon object
const POLYGON_MAP = {}
// iamge map: system_object_id of the image object => image object
const IMAGE_MAP = {}

class DenkxwebUtil {

    static async getXML(objects, metaData, accessToken, geoserverAuth, tagIds) {
        const dataForXml = {
            monuments: { '@': metaData, monument: [] }
        }

        // to save time we will try to reduce the number of requests to 3rd party APIs as much as possible.
        // To do that we bundle most of our API-requests.
        const themesPromise = this.#getBundledThemes(objects)
        const groupsPromise = this.#getBundledGroups(objects, accessToken)
        const groupMembersPromise = this.#getBundledGroupMembers(objects, accessToken, tagIds)
        const polygonPromise = this.#getBundledPolygons(objects, geoserverAuth)
        const imagePromise = this.#getBundledImages(objects, accessToken)

        await Promise.all([themesPromise, groupsPromise, groupMembersPromise, polygonPromise, imagePromise])

        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];

            var monument;
            try {
                monument = await this.#getMonument(object, accessToken, tagIds)
            } catch (error) {
                monument = {
                    uuid: object._uuid,
                    error: {
                        message: error.toString(),
                        stack: error.stack
                    },
                }
            }
            dataForXml.monuments.monument.push(monument)

        }

        const doc = create({ encoding: 'utf-8' }, dataForXml);

        // return dataForXml
        return doc.end({ prettyPrint: true });
    }

    static async #getMonument(object, accessToken, tagIds) {
        if (object._objecttype === 'item') {
            return await this.#getMonumentItem(object, accessToken, tagIds)
        } else if (object._objecttype === 'flaeche') {
            return await this.#getMonumentFlaeche(object, accessToken, tagIds)
        }
        return null;
    }

    static async #getMonumentItem(object, accessToken, tagIds) {
        const mappedData = await this.#mapDataItem(object, accessToken, tagIds)

        const monument = {
            '@': {
                // 'debug:objecttype': object._objecttype,
                'xmlns:gml': "http://www.opengis.net/gml/3.2",
                'xmlns': "http://www.rjm.de/denkxweb/denkxml",
                'xmlns:xlink': "http://www.w3.org/1999/xlink",
                'xmlns:xsi': "http://www.w3.org/2001/XMLSchema-instance",
                'gml:id': "monument." + mappedData.recId,
                'xsi:schemaLocation': "http://www.rjm.de/denkxweb/denkxml http://geoportal.geodaten.niedersachsen.de/adabweb/schema/denkgml/0.9/denkgml.xsd http://www.opengis.net/gml/3.2 http://geoportal.geodaten.niedersachsen.de/adabweb/schema/ogc/gml/3.2.1/gml.xsd",
            },
            'gml:identifier': {
                '@codeSpace': 'https://denkmalpflege.niedersachsen.de/',
                '#': 'monument.' + mappedData.recId
            },
            recId: mappedData.recId,
            fylrId: mappedData.fylrId,
            uuid: mappedData.uuid,
            adabwebId: mappedData.adabwebId,
            layer: mappedData.layer,
            level: mappedData.level,
            country: mappedData.country,
            state: mappedData.state,
            district: mappedData.district,
            jointCommunity: mappedData.jointCommunity,
            municipality: mappedData.municipality,
            boundary: mappedData.boundary,
            area: mappedData.area,
            address: mappedData.address,
            name: mappedData.name,
            description: mappedData.description,
            reason: mappedData.reason,
            recOrganization: mappedData.recOrganization,
            recDate: mappedData.recDate,
            recLastChangeDate: mappedData.recLastChangeDate,
            recLastChangeDateTime: mappedData.recLastChangeDateTime,
            bukCategory: mappedData.bukCategory,
            relevance: mappedData.relevance,
            legalState: mappedData.legalState,
            approved: mappedData.approved,
            buildingType: mappedData.buildingType,
            theme: mappedData.theme,
            themeDescription: mappedData.themeDescription,
            licence: mappedData.licence,
            ddaObj: mappedData.ddaObj,
            linkAdabweb: { '@url': mappedData.linkAdabweb },
            authoritativeRepresentation: { '@url': mappedData.authoritativeRepresentation },
            datingFrom: mappedData.datingFrom,
            ppnReference: mappedData.ppnReference,
            internetReference: mappedData.internetReference,
        }

        if (mappedData.preferredImage) {
            monument.preferredImage = { '@xlink:href': mappedData.preferredImage };
        }

        if (mappedData.notablePersons.length > 0) {
            monument.notablePersons = { person: [] };

            mappedData.notablePersons.forEach(person => {

                monument.notablePersons.person.push({
                    '@role': person.role,
                    name: person.name,
                });
            })
        }

        if (mappedData.groupMembers.length > 0) {
            monument.groupMembers = { member: [] };

            mappedData.groupMembers.forEach(member => {
                monument.groupMembers.member.push({
                    gId: member.gId,
                    fId: member.fId,
                    buildingType: member.buildingType,
                    address: member.address,
                    linkDda: { '@url': member.linkDda },
                })
            })
        }

        if (mappedData.groups.length > 0) {
            monument.groups = { group: [] };

            mappedData.groups.forEach(group => {
                monument.groups.group.push({
                    gId: group.gId,
                    fId: group.fId,
                    buildingType: group.buildingType,
                    description: group.description,
                    linkDda: { '@url': group.linkDda },
                })
            })
        }

        if (mappedData.images.length > 0) {
            monument.images = { image: [] }

            mappedData.images.forEach(image => {
                monument.images.image.push({
                    '@gml_id': 'Image.' + image.identifier,
                    description: image.description,
                    standard: { '@url': image.standard, '@fylrUrl': image.standard, '@type': image.mimeType },
                    filename: image.filename,
                    preferred: image.preferred,
                    creator: image.creator,
                    rights: image.rights,
                    licence: image.licence,
                    yearOfOrigin: image.yearOfOrigin,
                })
            })
        }


        // if polygon exists, point and linkDenkmalViewer should also exist
        if (mappedData.polygon && mappedData.point) {
            const polygonCoordinates = mappedData.polygon?.geometry?.coordinates?.flat(2)
            const pointCoordinates = mappedData.point?.geometry?.coordinates?.flat(2)
            if (Array.isArray(polygonCoordinates) && Array.isArray(polygonCoordinates)) {
                monument.linkDenkmalViewer = { '@url': mappedData.linkDenkmalViewer };
                monument.geoReference = {
                    position: {
                        'gml:Point': {
                            '@': {
                                'gml:id': `ii_v_m_dda_monument.fs_ix.${mappedData.recId}.geopos.Geom_0`,
                                srsName: "http://www.opengis.net/def/crs/epsg/0/25832",
                                srsDimension: '2'
                            },
                            'gml:pos': pointCoordinates.join(' '),
                        }
                    },
                    surface: {
                        'gml:MultiSurface': {
                            '@': {
                                'gml:id': `ii_v_m_dda_monument.fs_ix.${mappedData.recId}.geosurface.Geom_0`,
                                srsName: "http://www.opengis.net/def/crs/epsg/0/25832",
                                srsDimension: '2'
                            },
                            'gml:surfaceMember': {
                                'gml:Polygon': {
                                    '@': {
                                        'gml:id': `ii_v_m_dda_monument.fs_ix.${mappedData.recId}.geosurface.Geom_1`,
                                    },
                                    'gml:exterior': {
                                        'gml:LinearRing': {
                                            'gml:posList': polygonCoordinates.join(' '),
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return monument;
    }

    static async #getMonumentFlaeche(object, accessToken, tagIds) {
        const mappedData = await this.#mapDataFlaeche(object, accessToken, tagIds)

        const monument = {
            '@': {
                'debug:objecttype': object._objecttype,
                'xmlns:gml': "http://www.opengis.net/gml/3.2",
                'xmlns': "http://www.rjm.de/denkxweb/denkxml",
                'xmlns:xlink': "http://www.w3.org/1999/xlink",
                'xmlns:xsi': "http://www.w3.org/2001/XMLSchema-instance",
                'gml:id': "monument." + mappedData.recId,
                'xsi:schemaLocation': "http://www.rjm.de/denkxweb/denkxml http://geoportal.geodaten.niedersachsen.de/adabweb/schema/denkgml/0.9/denkgml.xsd http://www.opengis.net/gml/3.2 http://geoportal.geodaten.niedersachsen.de/adabweb/schema/ogc/gml/3.2.1/gml.xsd",
            },
            'gml:identifier': {
                '@codeSpace': 'https://denkmalpflege.niedersachsen.de/',
                '#': 'monument.' + mappedData.recId
            },
            recId: mappedData.recId,
            fylrId: mappedData.fylrId,
            name: mappedData.name,
            description: mappedData.description,
            state: mappedData.state,
            district: mappedData.district,
            jointCommunity: mappedData.jointCommunity,
            municipality: mappedData.municipality,
            boundary: mappedData.boundary,
            buildingType: mappedData.buildingType,
            layer: mappedData.layer,
            linkAdabweb: { '@url': mappedData.linkAdabweb },
            licence: mappedData.licence,
            authoritativeRepresentation: { '@url': mappedData.authoritativeRepresentation },
            ddaObj: mappedData.ddaObj,
            recOrganization: mappedData.recOrganization,
            recDate: mappedData.recDate,
            recLastChangeDate: mappedData.recLastChangeDate,
            recLastChangeDateTime: mappedData.recLastChangeDateTime,
        }

        if (mappedData.preferredImage) {
            monument.preferredImage = { '@xlink:href': mappedData.preferredImage };
        }
        // if polygon exists, point and linkDenkmalViewer should also exist
        if (mappedData.polygon && mappedData.point) {
            const polygonCoordinates = mappedData.polygon?.geometry?.coordinates?.flat(2)
            const pointCoordinates = mappedData.point?.geometry?.coordinates?.flat(2)
            if (Array.isArray(polygonCoordinates) && Array.isArray(polygonCoordinates)) {
                monument.linkDenkmalViewer = { '@url': mappedData.linkDenkmalViewer };
                monument.geoReference = {
                    position: {
                        'gml:Point': {
                            '@': {
                                'gml:id': `ii_v_m_dda_monument.fs_ix.${mappedData.recId}.geopos.Geom_0`,
                                srsName: "http://www.opengis.net/def/crs/epsg/0/25832",
                                srsDimension: '2'
                            },
                            'gml:pos': pointCoordinates.join(' '),
                        }
                    },
                    surface: {
                        'gml:MultiSurface': {
                            '@': {
                                'gml:id': `ii_v_m_dda_monument.fs_ix.${mappedData.recId}.geosurface.Geom_0`,
                                srsName: "http://www.opengis.net/def/crs/epsg/0/25832",
                                srsDimension: '2'
                            },
                            'gml:surfaceMember': {
                                'gml:Polygon': {
                                    '@': {
                                        'gml:id': `ii_v_m_dda_monument.fs_ix.${mappedData.recId}.geosurface.Geom_1`,
                                    },
                                    'gml:exterior': {
                                        'gml:LinearRing': {
                                            'gml:posList': polygonCoordinates.join(' '),
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return monument;

    }

    static async #mapDataItem(object, accessToken, tagIds) {
        // process.stdout.write(JSON.stringify({
        //     title: object.item['_nested:item__titel']?.[1].title
        // }, 2, null))

        const result = {
            recId: object._uuid,                                                                                        // Done
            fylrId: object._system_object_id,                                                                           // Done
            uuid: object._uuid,                                                                                         // Done
            adabwebId: null,                                                                                            // Done
            layer: object?.item?._pool?._path?.[2]?.pool?.name?.['de-DE'] || null,                                       // Done
            level: null,                                                                                                // Done
            country: "DE",                                                                                              // Done CL: "DE als Standardwert setzen oder aus der Konfiguration nehmen. Wird im Portal offenbar nicht verwendet."
            state: null,                                                                                                // Done
            district: null,                                                                                             // Done
            jointCommunity: null,                                                                                       // Done
            municipality: null,                                                                                         // Done
            boundary: null,                                                                                             // Done
            area: null,                                                                                                 // Done
            address: null,                                                                                              // Done
            name: object.item['_nested:item__titel']?.[1]?.titel || null,                                               // Done
            description: null,                                                                                          // Done
            reason: null,                                                                                               // Done
            recOrganization: "NLD",                                                                                     // Done
            recDate: null,                                                                                              // Done
            recLastChangeDate: null,                                                                                    // Done
            recLastChangeDateTime: null,                                                                                // Done
            bukCategory: object.item?.['_nested:item__objektkategorie']?.[0]?.lk_objektkategorie.conceptName || null,   // Done
            relevance: null,                                                                                            // Done
            legalState: null,                                                                                           // Done
            approved: null,                                                                                             // Done
            buildingType: this.#getBuildingType(object),                                                                // Done
            theme: [],                                                                                                  // Done
            themeDescription: null,                                                                                     // Done
            licence: "CC BY-SA 4.0",                                                                                    // done
            ddaObj: null,                                                                                               // Done
            linkAdabweb: `https://nfis.gbv.de/#/detail/${object._uuid}`,                                                // Done
            linkDenkmalViewer: null,                                                                                    // Done
            authoritativeRepresentation: 'https://denkmalpflege.niedersachsen.de/startseite/',                          // Done
            datingFrom: null,                                                                                           // Done
            point: null,                                                                                                // Done
            polygon: null,                                                                                              // Done
            groups: [],                                                                                                 // Done
            groupMembers: [],                                                                                           // Done
            ppnReference: [],                                                                                           // Done
            internetReference: [],                                                                                      // Done
            notablePersons: [],                                                                                         // Done
            preferredImage: null,                                                                                       // Done
            images: []                                                                                                  // Done
        }

        const politicalAffiliation = object.item?.['_nested:item__politische_zugehoerigkeit']?.[0]
        if (politicalAffiliation) {
            const affiliationStrings = politicalAffiliation?.lk_politische_zugehoerigkeit?.conceptName?.split('➔')
            result.state = affiliationStrings?.[0]?.trim() || null;
            result.district = affiliationStrings?.[1]?.trim() || null;
            result.jointCommunity = affiliationStrings?.[2]?.replace('Samtgemeinde', '').trim() || null;
            result.municipality = affiliationStrings?.[3]?.trim() || null;
            result.boundary = affiliationStrings?.[4]?.trim() || null;
            result.area = politicalAffiliation.stadtteil?.trim() || null
        }

        // map tag ids
        for (let i = 0; i < object._tags.length; i++) {
            const tag = object._tags[i];
            switch (tag._id) {
                // Level
                case tagIds.level_0:
                    result.level = 0
                    break;
                case tagIds.level_1:
                    result.level = 1
                    break;
                case tagIds.level_2:
                    result.level = 2
                    break;
                case tagIds.level_3:
                    result.level = 3
                    break;
                // ddaObj
                case tagIds.public:
                    result.ddaObj = true
                    break;
                case tagIds.not_public:
                    result.ddaObj = false
                    break;
                // approved
                case tagIds.directory_object:
                    result.approved = true
                    break;
                case tagIds.not_directory_object:
                    result.approved = false
                    break;
            }
        }

        const adabwebIdentifier = object.item?.['_nested:item__identifier']?.find((identifier) => identifier.lk_identifier_typ?.conceptURI === ADABWEB_IDENTIFIER_URI)
        if (adabwebIdentifier) {
            result.adabwebId = adabwebIdentifier.identifier
        }

        const currentAddress = object.item?.['_nested:item__anschrift']?.find((address) => address.lk_adresstyp?.conceptURI === CURRENT_ADDRESS_URI)
        if (currentAddress) {
            result.address = `${currentAddress.strasse || ''} ${currentAddress.hausnummer || ''} ${currentAddress?.hausnummer_zusatz || ''}`.trim().replace('  ', ' ')
        }

        // object is Level 0 => we are not allowed to send this data
        if (result.level > 0) {
            const objectDescription = object.item?.['_nested:item__beschreibung']?.find((description) => {
                return description.lk_beschreibungstyp.conceptURI === OBJECT_DESCRIPTION_URI && description?.lk_veroeffentlichen?.ja_nein_objekttyp?._id === 1
            })
            const reason = object.item?.['_nested:item__beschreibung']?.find((description) => {
                return description.lk_beschreibungstyp.conceptURI === REASON_DESCRIPTION_URI && description?.lk_veroeffentlichen?.ja_nein_objekttyp?._id === 1
            })

            result.description = objectDescription?.text || null
            result.reason = reason?.text || null
        }

        // Date string is saved in UTC, so we need to convert to local time
        result.recDate = this.#getLocalDateString(new Date(object._created))
        result.recLastChangeDate = this.#getLocalDateString(new Date(object._last_modified))
        result.recLastChangeDateTime = this.#getLocalISODateString(new Date(object._last_modified))

        // extact result from events
        const events = object.item?.['_nested:item__event'];
        const relevanceArray = []
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            switch (event.lk_eventtyp?.conceptURI) {

                case DESIGNATION_EVENT_TYPE_URI:
                    if (event.lk_veroeffentlichen?.ja_nein_objekttyp?._id === 1) {
                        relevanceArray.push(...this.#getRelevanceArray(event))
                    }
                    if (result.legalState === null) {
                        result.legalState = event.lk_status?.conceptName
                    }

                    break;

                case CREATION_EVENT_TYPE_URI:
                    if (event.lk_veroeffentlichen?.ja_nein_objekttyp?._id === 1 && result.datingFrom === null) {
                        result.datingFrom = this.#getDatingFrom(event, object.item)
                    }

                default:
                    break;
            }
        }

        if (relevanceArray.length > 0) {
            result.relevance = relevanceArray.join(', ');
        }

        const themeDescription = object.item?.['_nested:item__beschreibung']?.find((description) => {
            return description.lk_beschreibungstyp === THEME_DESCRIPTION_URI && description?.lk_veroeffentlichen?.ja_nein_objekttyp?._id === 1
        })
        result.themeDescription = themeDescription || null

        result.ppnReference = this.#getPpnReference(object)
        result.internetReference = this.#getInternetReference(object)
        result.notablePersons = this.#getNotablePersons(object)

        const preferredImageId = object.item['_reverse_nested:objekt__bild:lk_objekt']?.[0]?.lk_bild?._system_object_id || null
        if (preferredImageId) {
            result.preferredImage = `urn:x-adabweb:${preferredImageId}`
        }

        result.groups = this.#getGroups(object, accessToken);
        result.theme = this.#getThemes(object.item?.['_nested:item__thema'] || []);
        result.groupMembers = this.#getGroupMembers(object)
        result.images = this.#getImages(object, preferredImageId);
        result.polygon = this.#getPolygon(object);

        if (result.polygon) {
            result.point = pointOnFeature(result.polygon);
            result.linkDenkmalViewer = this.#getLinkDenkmalViewer(result.point)
        }

        return result
    }

    static async #mapDataFlaeche(object, accessToken, tagIds) {
        const result = {
            recId: object._uuid,
            fylrId: object._system_object_id,
            name: object.flaeche?.titel || null,
            description: null,
            state: null,
            district: null,
            jointCommunity: null,
            municipality: null,
            boundary: null,
            buildingType: object.flaeche?.lk_dante_art?.conceptName || null,
            layer: object?.flaeche._pool?._path?.[2]?.pool?.name?.['de-DE'] || null,
            linkAdabweb: `https://nfis.gbv.de/#/detail/${object._uuid}`,
            licence: "CC BY-SA 4.0",
            authoritativeRepresentation: "https://denkmalpflege.niedersachsen.de/startseite/",
            // Date string is saved in UTC, so we need to convert to local time
            recDate: this.#getLocalDateString(new Date(object._created)),
            recLastChangeDate: this.#getLocalDateString(new Date(object._last_modified)),
            recLastChangeDateTime: this.#getLocalISODateString(new Date(object._last_modified)),
            recOrganization: "NLD",

            ddaObj: null, // needs a new field in NFIS?
            point: null,
            polygon: null,
            preferredImage: null,
        }

        const politicalAffiliation = object.flaeche?.['_nested:flaeche__politische_zugehoerigkeit']?.[0]
        if (politicalAffiliation) {
            const affiliationStrings = politicalAffiliation?.lk_politische_zugehoerigkeit?.conceptName?.split('➔')
            result.state = affiliationStrings?.[0]?.trim() || null;
            result.district = affiliationStrings?.[1]?.trim() || null;
            result.jointCommunity = affiliationStrings?.[2]?.replace('Samtgemeinde', '').trim() || null;
            result.municipality = affiliationStrings?.[3]?.trim() || null;
            result.boundary = affiliationStrings?.[4]?.trim() || null;
        }

        const objectDescription = object.flaeche?.['_nested:flaeche__beschreibung']?.find((description) => {
            return description.lk_beschreibungstyp.conceptURI === OBJECT_DESCRIPTION_URI && description?.lk_veroeffentlichen?.ja_nein_objekttyp?._id === 1
        })
        result.description = objectDescription?.text || null

        const preferredImageId = object.flaeche['_reverse_nested:flaeche__bild:lk_flaeche']?.[0]?.lk_bild?._system_object_id || null
        if (preferredImageId) {
            result.preferredImage = `urn:x-adabweb:${preferredImageId}`
        }
        result.polygon = this.#getPolygon(object);

        if (result.polygon) {
            result.point = pointOnFeature(result.polygon);
            result.linkDenkmalViewer = this.#getLinkDenkmalViewer(result.point)
        }

        return result
    }
    // The node process in the docker container does not know our local timezone, 
    // so we cannot rely on the Date class to convert to the correct local time
    static #partsInTimeZone(date, timeZone = LOCAL_TZ) {
        const dtf = new Intl.DateTimeFormat("en-US", {
            timeZone,
            hour12: false,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });

        const bag = {};
        for (const { type, value } of dtf.formatToParts(date)) {
            if (type !== "literal") bag[type] = value;
        }
        return {
            year: bag.year,
            month: bag.month,
            day: bag.day,
            hour: bag.hour,
            minute: bag.minute,
            second: bag.second,
        };
    }

    static #getLocalDateString(date) {
        const { year, month, day } = this.#partsInTimeZone(date);
        return `${year}-${month}-${day}`;
    }
    static #getLocalISODateString(date) {
        const { year, month, day, hour, minute, second } = this.#partsInTimeZone(date);
        const millis = String(date.getMilliseconds()).padStart(3, "0"); // sub-second is time-zone agnostic
        return `${year}-${month}-${day}T${hour}:${minute}:${second}.${millis}`;
    }

    static #getRelevanceArray(event) {
        const array = [];
        for (let i = 0; i < event['_nested:item__event__bedeutung'].length; i++) {
            const relevanceEvent = event['_nested:item__event__bedeutung'][i];
            const relevance = relevanceEvent?.lk_bedeutung?.conceptName
            if (relevance) {
                array.push(relevance)
            }
        }
        return array;
    }

    static #getThemes(themesArray) {
        const labels = [];

        for (let i = 0; i < themesArray.length; i++) {
            const theme = themesArray[i];
            const URI = theme.lk_thema.conceptURI
            if (THEMES_MAP[URI]) {
                labels.push(THEMES_MAP[URI]);
            }
        }

        return labels;
    }

    static async #getBundledThemes(objects) {
        // uri can be a | divided list, so we can bundle the request
        const URIs = {};

        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];
            if (object._objecttype !== 'item') continue;

            const themesArray = object.item?.['_nested:item__thema'] || []
            for (let j = 0; j < themesArray.length; j++) {
                const theme = themesArray[j];
                if (theme?.lk_thema?.conceptURI) {
                    URIs[theme.lk_thema.conceptURI] = true
                }
            }
        }

        const URIArray = Object.keys(URIs)
        if (URIArray.length === 0) return []

        // This API only accepts GET-Parameters and the server has a request URI-Limit. 
        // To get around that we need to request our URIs in chunks to stay below the limit.
        const requestArray = [];
        const chunkSize = 50;
        for (let i = 0; i < URIArray.length; i += chunkSize) {
            const URIChunk = URIArray.slice(i, i + chunkSize);
            const URIListString = URIChunk.join('|');
            const danteApiUrl = `https://api.dante.gbv.de/data?uri=${URIListString}&properties=+hiddenLabel`

            const request = fetch(danteApiUrl);
            requestArray.push(request)
        }

        const responses = await Promise.all(requestArray);

        const jsonPromises = []
        responses.forEach(response => jsonPromises.push(response.json()))

        const themesJsonArray = await Promise.all(jsonPromises)
        themesJsonArray.forEach(themesJson => {
            for (let i = 0; i < themesJson.length; i++) {
                const theme = themesJson[i];
                const label = theme.hiddenLabel?.de?.[0]
                const URI = theme.uri
                if (label && URI) {
                    THEMES_MAP[URI] = label
                }
            }
        })
    }

    static #getDatingFrom(event, item) {

        switch (item?._pool._path?.[2]?.pool?.name?.['de-DE']) {
            case 'Archäologie':
                return event?.lk_zeitstellung?.conceptName || null
            case 'Baudenkmalpflege':
                return event?.datierung_verbal || null

            default:
                return null;
        }
    }

    static #getGroups(object) {
        const groups = [];

        object.item?._parents.forEach(parent => {
            const fullParent = GROUP_MAP[parent._system_object_id];
            if (!fullParent) return;

            groups.push({
                gId: fullParent._system_object_id,
                fId: object._system_object_id,
                buildingType: this.#getBuildingType(fullParent),
                // linkDda: null,
                linkDda: `https://denkmalatlas.niedersachsen.de/viewer/metadata/${fullParent._uuid}`,
            });
        });

        return groups;
    }

    static async #getBundledGroups(objects, accessToken) {
        const parentIds = [];

        objects.forEach(object => {
            if (object._objecttype !== 'item') return;

            object.item?._parents.forEach(parent => {
                parentIds.push(parent._system_object_id)
                GROUP_MAP[parent._system_object_id] = null;
            });
        });

        if (parentIds.length === 0) return


        const searchPayload = {
            "offset": 0,
            "limit": parentIds.length,
            "format": "long",
            "search": [
                {
                    "type": "complex",
                    "__filter": "SearchInput",
                    "search": [
                        {
                            "type": "complex",
                            "search": [
                                {
                                    "type": "in",
                                    "in": parentIds,
                                    "fields": ["_system_object_id"],
                                    "bool": "must"
                                }
                            ],
                            "bool": "must"
                        }
                    ]
                }
            ],
            "objecttypes": ["item"],
        }

        const response = await fetch('http://fylr.localhost:8081/api/v1/search?pretty=0', {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + accessToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(searchPayload),
        })
        const jsonResponse = await response.json()


        const parents = jsonResponse?.objects?.filter((parent) => {
            return parent.item?.['_nested:item__objektkategorie']?.some((category) => {
                return category.lk_objektkategorie?.conceptURI === PARENT_OBJECT_TYPE_URI
            })
        })

        for (let i = 0; i < parents.length; i++) {
            const parent = parents[i];
            GROUP_MAP[parent._system_object_id] = parent;
        }
    }

    static #getGroupMembers(object) {
        const members = GROUP_MEMBER_MAP[object._system_object_id] || [];
        const returnValue = [];

        for (let i = 0; i < members.length; i++) {
            const member = members[i];

            const memberObject = {
                gId: object._system_object_id,
                fId: member._system_object_id,
                buildingType: this.#getBuildingType(member),
                address: null,
                // linkDda: null,
                linkDda: `https://denkmalatlas.niedersachsen.de/viewer/metadata/${member._uuid}`,
            }

            const currentAddress = member.item?.['_nested:item__anschrift']?.find((address) => address.lk_adresstyp?.conceptURI === CURRENT_ADDRESS_URI)
            if (currentAddress && currentAddress.strasse && currentAddress.hausnummer) {
                memberObject.address = `${currentAddress.strasse || ''} ${currentAddress.hausnummer || ''} ${currentAddress?.hausnummer_zusatz || ''}`.trim().replace('  ', ' ')
            } else {
                // if address is missing use schema jointCommunity - municipality
                const strings = object.item?.['_nested:item__politische_zugehoerigkeit']?.[0]?.lk_politische_zugehoerigkeit?.conceptName?.split('➔')
                if (Array.isArray(strings) && strings.length >= 4) {
                    memberObject.address = `${strings[2].trim()} - ${strings[3].trim()}`
                }
            }

            returnValue.push(memberObject);
        }
        return returnValue
    }

    static async #getBundledGroupMembers(objects, accessToken, tagIds) {
        const parentIds = [];

        objects.forEach(object => {
            if (object._objecttype !== "item") return;
            if (!object._has_children) return;
            parentIds.push(object.item._id)
        });
        if (parentIds.length === 0) return


        const searchPayload = {
            "offset": 0,
            "limit": 1000,
            "format": "long",
            "search": [
                {
                    "type": "in",
                    "in": parentIds,
                    "fields": ["item._parents.item._id"],
                    "bool": "must"
                }

            ],
            "objecttypes": ["item"],
        }

        const response = await fetch('http://fylr.localhost:8081/api/v1/search?pretty=0', {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + accessToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(searchPayload),
        })

        const jsonResponse = await response.json()
        const members = jsonResponse?.objects?.filter((parent) => {
            return parent._tags?.some(tag => tag._id === tagIds.public)
        })

        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const parents = member?.item?._parents
            if (!Array.isArray(parents)) continue;

            parents.forEach(parent => {
                if (!Array.isArray(GROUP_MEMBER_MAP[parent._system_object_id])) {
                    GROUP_MEMBER_MAP[parent._system_object_id] = []
                }
                GROUP_MEMBER_MAP[parent._system_object_id].push(member);
            });
        }

    }

    static #getPpnReference(object) {
        const references = [];
        const validLiterature = object.item?.['_nested:item__literatur']?.filter((literature) => {
            const correctType = literature.lk_literatur_typ?.conceptURI === LITERATURE_REFERENCE_TYPE_URI
            const isPublic = literature.lk_veroeffentlichen.ja_nein_objekttyp._id === 1
            return correctType && isPublic;
        })

        if (!validLiterature || validLiterature.length === 0) {
            return [];
        }

        for (let i = 0; i < validLiterature.length; i++) {
            const literature = validLiterature[i];
            const ppn = literature.lk_literatur_k10plus?.conceptURI?.split('ppn:')?.[1] || null
            if (!ppn) continue;

            references.push({
                ppn: ppn,
                literatureQuotation: literature.seite,
            })
        }

        return references;
    }

    static #getInternetReference(object) {
        const references = [];
        const validReferences = object.item?.['_nested:item__literatur']?.filter((reference) => {
            const correctType = reference.lk_literatur_typ?.conceptURI === INTERNET_REFERENCE_TYPE_URI
            const isPublic = reference.lk_veroeffentlichen.ja_nein_objekttyp._id === 1
            return correctType && isPublic;
        })
        if (!validReferences || validReferences.length === 0) {
            return [];
        }

        for (let i = 0; i < validReferences.length; i++) {
            const reference = validReferences[i];

            references.push({
                description: reference.link?.text_plain || null,
                link: reference.link?.url || null,
            })
        }

        return references;
    }

    static #getNotablePersons(object) {
        const persons = [];
        const creationEvent = object.item?.['_nested:item__event']?.find((event) => {
            const correctType = event.lk_eventtyp?.conceptURI === CREATION_EVENT_TYPE_URI;
            const isPublic = event.lk_veroeffentlichen?.ja_nein_objekttyp?._id === 1
            return correctType && isPublic
        })
        const eventPersons = creationEvent?.['_nested:item__event__person_institution']

        if (!eventPersons || eventPersons.length === 0) {
            const importField = object.item?.['_nested:item__importfelder']?.filter((field) => field.name === 'Beteiligte Person')

            if (!Array.isArray(importField) || importField.length === 0) return []

            importField.forEach(field => {
                persons.push({
                    name: field.inhalt,
                    role: null,
                })
            })

            return persons;
        }


        for (let i = 0; i < eventPersons.length; i++) {
            const eventPerson = eventPersons[i];
            const name = eventPerson?.lk_person_institution?.conceptName
            const role = eventPerson?.['_nested:item__event__person_institution__rolle']?.[0]?.lk_rolle?.conceptName

            persons.push({
                name,
                role
            })
        }


        return persons
    }

    static #getPolygon(object) {
        const objecttype = object._objecttype
        // TODO: Nachdem testen die statische ID rausnehmen
        // const ouuid = Math.random() > 0.5 ? "321dfe21-293f-47d6-ac20-7ae058570e8c" : "10135592-550f-47bc-bdd3-38a99d8be43f"
        const ouuid = object[objecttype]?.lk_nfis_geometrie?.geometry_ids?.[0] || null;
        if (!ouuid) return null;


        return POLYGON_MAP[ouuid] || null
    }

    static async #getBundledPolygons(objects, geoserverAuth) {

        const ouuids = [];
        objects.forEach(object => {
            const objecttype = object._objecttype
            // TODO: Nachdem testen die statische ID rausnehmen
            // const ouuid = Math.random() > 0.5 ? "321dfe21-293f-47d6-ac20-7ae058570e8c" : "10135592-550f-47bc-bdd3-38a99d8be43f"
            const ouuid = object[objecttype]?.lk_nfis_geometrie?.geometry_ids?.[0] || null;

            if (!ouuid) return;

            ouuids.push(`'${ouuid}'`)
        });

        if (ouuids.length === 0) return;

        const url = `https://geodaten.nfis6.gbv.de/geoserver/viewer/wfs/?service=WFS&version=1.1.0&request=GetFeature&typename=objekt_fylr_preview&outputFormat=application/json&srsname=EPSG:25832`
        const urlEncodedBody = new URLSearchParams()
        urlEncodedBody.append('cql_filter', `ouuid in (${ouuids.join(',')})`)

        const requestOptions = {
            method: 'POST',
            redirect: 'follow',
            headers: {
                "Authorization": "Basic " + geoserverAuth,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: urlEncodedBody
        }
        const response = await fetch(url, requestOptions)
        if (!response.ok) {
            return;
        }

        const featureCollection = await response.json()
        if (!featureCollection.features || featureCollection.features.length === 0) {
            return;
        }
        featureCollection.features.forEach(feature => {
            if (!feature?.properties?.ouuid) return
            if (!Array.isArray(feature?.geometry?.coordinates) || feature.geometry.coordinates.length === 0) return
            POLYGON_MAP[feature.properties.ouuid] = feature
        });

    }

    static #getLinkDenkmalViewer(point) {
        if (!Array.isArray(point.geometry?.coordinates) || point.geometry?.coordinates?.length < 2) return null;
        const x = Math.round(point.geometry.coordinates[0]);
        const y = Math.round(point.geometry.coordinates[1]);

        const link = `https://maps.lgln.niedersachsen.de/nld/mapbender/application/denkmalatlas?poi[point]=${x},${y}&poi[scale]=5000`;
        return link;
    }

    static #getImages(object, preferredImageId) {
        if (!Array.isArray(object.item['_reverse_nested:objekt__bild:lk_objekt'])) return []
        if (object.item['_reverse_nested:objekt__bild:lk_objekt'].length === 0) return []

        const returnImages = [];
        const imageObjects = []

        object.item['_reverse_nested:objekt__bild:lk_objekt'].forEach((imageData) => {
            const lkBild = imageData.lk_bild
            if (!lkBild?._system_object_id || !IMAGE_MAP[lkBild._system_object_id]) return

            imageObjects.push(IMAGE_MAP[lkBild._system_object_id])

        })

        if (imageObjects.length === 0) {
            return []
        }


        for (let i = 0; i < imageObjects.length; i++) {
            const imageObject = imageObjects[i];
            if (!imageObject.bild || imageObject.bild?.lk_veroeffentlichen?.ja_nein_objekttyp?._id !== 1) continue;

            const image = {
                identifier: imageObject._system_object_id,
                description: imageObject.bild.titel,
                standard: null,
                preferred: imageObject._system_object_id === preferredImageId,
                creator: imageObject.bild.urheberin,
                rights: imageObject.bild.rechteinhaberin,
                licence: "CC-BY-SA 4.0",
                yearOfOrigin: null,
                mimeType: null,
                filename: imageObject.bild?.bild?.[0]?.original_filename || null
            }

            // this url is the only part of the image object that is not optional in the xml schem
            // so of course it's the only thing we can't currently get, because the api doesn't deliver the data for the original image
            image.standard = imageObject.bild?.bild?.[0]?.versions?.original?.deep_link_url || null
            image.mimeType = imageObject.bild?.bild?.[0]?.versions?.original?.technical_metadata?.mime_type || null
            image.yearOfOrigin = imageObject.bild?.entstehungsdatum?.value?.split('-')[0];

            if (image.standard) {
                returnImages.push(image)
            }
        }

        return returnImages;
    }

    static async #getBundledImages(objects, accessToken) {

        const imageIds = [];
        objects.forEach(object => {
            if (object._objecttype !== 'item') return;
            if (!Array.isArray(object.item['_reverse_nested:objekt__bild:lk_objekt'])) return
            if (object.item['_reverse_nested:objekt__bild:lk_objekt'].length === 0) return

            object.item['_reverse_nested:objekt__bild:lk_objekt'].forEach((imageData) => {
                const lkBild = imageData.lk_bild
                if (!lkBild?._system_object_id) return;
                imageIds.push(lkBild._system_object_id)
            })
        });

        if (imageIds.length === 0) {
            return;
        }

        const searchPayload = {
            "offset": 0,
            "limit": imageIds.length,
            "format": "long",
            "search": [
                {
                    "type": "complex",
                    "__filter": "SearchInput",
                    "search": [
                        {
                            "type": "complex",
                            "search": [
                                {
                                    "type": "in",
                                    "in": imageIds,
                                    "fields": ["_system_object_id"],
                                    "bool": "must"
                                }
                            ],
                            "bool": "must"
                        }
                    ]
                }
            ],
            "objecttypes": ["bild"],
        }

        const response = await fetch('http://fylr.localhost:8081/api/v1/search?pretty=0', {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + accessToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(searchPayload),
        })
        const jsonResponse = await response.json()
        const imageObjects = jsonResponse.objects

        for (let i = 0; i < imageObjects.length; i++) {
            const imageObject = imageObjects[i];
            if (!imageObject.bild || imageObject.bild?.lk_veroeffentlichen?.ja_nein_objekttyp?._id !== 1) continue;

            IMAGE_MAP[imageObject._system_object_id] = imageObject
        }
    }

    static #getBuildingType(object) {
        if (!object.item?.lk_objekttyp?.conceptName) return null

        if (object.item.lk_objekttyp.conceptName.includes('➔')) {
            const buildingTypeStrings = object.item.lk_objekttyp.conceptName.split('➔')
            return buildingTypeStrings[buildingTypeStrings.length - 1]
        }

        return object.item.lk_objekttyp.conceptName
    }
}


module.exports = DenkxwebUtil;