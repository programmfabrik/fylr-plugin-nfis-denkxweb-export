> This Plugin / Repo is being maintained by a community of developers.
There is no warranty given or bug fixing guarantee; especially not by
Programmfabrik GmbH. Please use the github issue tracking to report bugs
and self organize bug fixing. Feel free to directly contact the committing
developers.

# nfis-denkxweb-export
Custom endpoints for fylr-API
The plugin provides several new  API endpoints. Each endpoint is explained below.
- Every endpoint required authentication and the authenticated user must have the "use_denkxweb_endpoint" system right.
- The user bearer token has to be passed in the "Authorization" header as usual.

## /export endpoint

> "GET /api/v1/plugin/extension/nfis-denkxweb-export/export".

The endpoint accepts the following GET-Parameters:

| name     | type    | required | default | description                                                                        |
|----------|---------|----------|---------|------------------------------------------------------------------------------------|
| limit    | integer | false    | 1000    | Limits entries to the first X entries found.                                       |
| offset   | integer | false    | 0       | Skip X entries                                                                     |
| fromDate | String  | false    |         | Format: YYYY-MM-DD Limits entries to those that have been changed since that date. |

## /public endpoint

> "GET /api/v1/plugin/extension/nfis-denkxweb-export/public".

The endpoint accepts the following GET-Parameters:

| name     | type    | required | default | description                                                                        |
|----------|---------|----------|---------|------------------------------------------------------------------------------------|
| limit    | integer | false    | 1000    | Limits entries to the first X entries found.                                       |
| offset   | integer | false    | 0       | Skip X entries                                                                     |

## /uuid endpoint

> "GET /api/v1/plugin/extension/nfis-denkxweb-export/uuid".

The endpoint accepts the following GET-Parameters:

| name     | type    | required | default | description                                                                        |
|----------|---------|----------|---------|------------------------------------------------------------------------------------|
| uuid     | string  | true     |         | The UUID of the monument that you want to retrieve                                 |


## installation

The latest version of this plugin can be found [here](https://github.com/programmfabrik/fylr-plugin-nfis-denkxweb-export/releases/latest/download/nfisDenkxwebExport.zip).

The ZIP can be downloaded and installed using the plugin manager, or used directly (recommended).

Github has an overview page to get a list of [all release](https://github.com/programmfabrik/fylr-plugin-nfis-denkxweb-export/releases/).

## configuration

* baseconfig
  * enable (true|false)

* systemright
  * assign new systemright "use_denkxweb_endpoint" to user and thereby allow usage of this custom endpoint

## example

```
Authorization: Bearer <access_token>

GET https://example.fylr.io/api/v1/plugin/extension/nfis-denkxweb-export/export?limit=100&offset=0&fromDate=2025-08-14"
```

Result is as usual "text/xml"

## sources

The source code of this plugin is managed in a git repository at <https://github.com/programmfabrik/fylr-plugin-nfis-denkxweb-export>.
