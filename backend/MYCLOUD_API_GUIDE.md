# MyCloud API Guide

This document provides instructions for integrating with the MyCloud API, which allows users to store, manage, and retrieve their personal files.

## Authentication

All API endpoints require a valid `Authorization` header with a Bearer Token (JWT). The user's ID will be extracted from this token on the server side.

```
Authorization: Bearer <your_jwt_token>
```

## Data Model

### MyCloud Object

This object represents a file stored in MyCloud.

| Field         | Type    | Description                                                 |
|---------------|---------|-------------------------------------------------------------|
| `id`          | String  | Unique identifier for the file.                             |
| `userId`      | String  | ID of the user who owns the file.                           |
| `fileName`    | String  | Original name of the uploaded file.                         |
| `s3Key`       | String  | The key of the file object in the S3 bucket.                |
| `fileUrl`     | String  | A pre-signed URL to access the file. This URL is temporary. |
| `typeFile`    | String  | The general type of the file. Enum: `image`, `video`, `audio`, `document`, `other`. |
| `mimeType`    | String  | The specific MIME type of the file (e.g., `image/png`).     |
| `fileSize`    | Long    | File size in bytes.                                         |
| `uploadedAt`  | String  | The timestamp when the file was uploaded (ISO-8601 format). |
| `createdAt`   | String  | The timestamp when the record was created (ISO-8601 format).|
| `deleted`     | Boolean | A flag for soft-deleting the file. `true` if deleted.       |


---

## API Endpoints

### 1. Upload a File

Uploads a single file to the user's cloud storage.

- **Method**: `POST`
- **URL**: `/api/v1/my-cloud/upload`
- **Content-Type**: `multipart/form-data`

#### Request

The request must be a `multipart/form-data` request with a single part named `file`.

| Part Name | Type | Description                  |
|-----------|------|------------------------------|
| `file`    | File | The file to be uploaded.     |

#### Response

**On Success (200 OK):**

Returns a standard `ApiResponse` containing the `MyCloudResponse` object for the uploaded file.

```json
{
  "status": "success",
  "data": {
    "id": "file_id_123",
    "fileName": "example.png",
    "fileUrl": "https://s3-presigned-url/for/example.png?...",
    "typeFile": "image",
    "mimeType": "image/png",
    "fileSize": 102400,
    "uploadedAt": "2026-05-24T10:00:00Z"
  },
  "message": null,
  "statusCode": 200
}
```

**On Error (500 Internal Server Error):**

```json
{
  "status": "error",
  "data": null,
  "message": "File upload failed: [reason]",
  "statusCode": 500
}
```

---

### 2. Get File Details

Retrieves the details of a specific file, including a new pre-signed URL for access.

- **Method**: `GET`
- **URL**: `/api/v1/my-cloud/{fileId}`

#### Path Parameters

| Parameter | Type   | Description                     |
|-----------|--------|---------------------------------|
| `fileId`  | String | The unique ID of the file to retrieve. |

#### Response

**On Success (200 OK):**

Returns the `MyCloudResponse` object directly.

```json
{
  "id": "file_id_123",
  "fileName": "example.png",
  "fileUrl": "https://s3-presigned-url/for/example.png?...",
  "typeFile": "image",
  "mimeType": "image/png",
  "fileSize": 102400,
  "uploadedAt": "2026-05-24T10:00:00Z"
}
```

**On Error (404 Not Found):**

If the file does not exist or does not belong to the user.

---

### 3. List Files

Retrieves a paginated list of files for the authenticated user. Supports filtering by file type.

- **Method**: `GET`
- **URL**: `/api/v1/my-cloud`

#### Query Parameters

| Parameter  | Type   | Default | Description                                                                                             |
|------------|--------|---------|---------------------------------------------------------------------------------------------------------|
| `fileType` | String | `null`  | (Optional) Filter files by type. Allowed values: `image`, `video`, `audio`, `document`, `other`.         |
| `limit`    | Int    | `20`    | (Optional) The maximum number of items to return per page.                                              |
| `nextKey`  | String | `null`  | (Optional) The cursor for the next page, obtained from the `nextKey` field of the previous response. It is a Base64-encoded string. |

#### Response

**On Success (200 OK):**

Returns a `MyCloudPageResponse` object which contains the list of files and pagination information.

```json
{
  "items": [
    {
      "id": "file_id_123",
      "fileName": "document.pdf",
      "fileUrl": "https://s3-presigned-url/for/document.pdf?...",
      "typeFile": "document",
      "mimeType": "application/pdf",
      "fileSize": 204800,
      "uploadedAt": "2026-05-24T11:00:00Z"
    },
    {
      "id": "file_id_124",
      "fileName": "song.mp3",
      "fileUrl": "https://s3-presigned-url/for/song.mp3?...",
      "typeFile": "audio",
      "mimeType": "audio/mpeg",
      "fileSize": 3145728,
      "uploadedAt": "2026-05-24T10:30:00Z"
    }
  ],
  "nextKey": "eyJsYXN0S2V5Ijp7InVzZXJfaWQiOnsiUyI6InVzZXJfaWQifSwidXBsb2FkZWRfYXQiOnsiUyI6IjIwMjYtMDUtMjRUMTA6MzA6MDBaIn19fQ==",
  "hasNext": true
}
```

- `items`: An array of `MyCloudResponse` objects.
- `nextKey`: The cursor to use in the next request to get the following page. If `null`, you have reached the last page.
- `hasNext`: A boolean indicating if there are more pages available.

---

### 4. Delete a File

Marks a file as deleted (soft delete). The file is not permanently removed but will no longer appear in lists.

- **Method**: `DELETE`
- **URL**: `/api/v1/my-cloud/{fileId}`

#### Path Parameters

| Parameter | Type   | Description                     |
|-----------|--------|---------------------------------|
| `fileId`  | String | The unique ID of the file to delete. |

#### Response

**On Success (204 No Content):**

The server returns an empty response with a 204 status code.

**On Error (404 Not Found):**

If the file does not exist or does not belong to the user.

