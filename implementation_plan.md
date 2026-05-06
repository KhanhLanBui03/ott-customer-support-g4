# Implementation Plan - Separate Attachment Icons

This plan outlines the steps to separate the single attachment icon into three distinct icons for sending Images, Files, and Folders in the `MessageInput` component.

## User Review Required

> [!IMPORTANT]
> The addition of two more icons to the input area might increase its width. We will ensure the layout remains responsive, but please confirm if you have a specific design preference for the arrangement of these icons.

> [!NOTE]
> Folder upload via `webkitdirectory` will select all files within a folder. The behavior will be to upload all files individually, as most web-based chat apps do not support uploading an actual directory structure in a single message.

## Proposed Changes

### Web Component

#### [MODIFY] [index.jsx](file:///c:/CNM/chat-app/web/src/components/MessageInput/index.jsx)

- **Imports**: Add `Folder` and `Image` from `lucide-react`.
- **Refs**: Add `imageInputRef` and `folderInputRef`.
- **Input Elements**: 
    - Keep `fileInputRef` and its input.
    - Add an input for images with `accept="image/*"`.
    - Add an input for folders with `webkitdirectory="" directory=""`.
- **UI (JSX)**:
    - Replace the single `Paperclip` button with three separate buttons:
        - **Image Button**: Using `ImageIconLucide` icon.
        - **File Button**: Using `FileText` or `Paperclip` icon.
        - **Folder Button**: Using `Folder` icon.
    - Maintain the existing styling and "tooltip" behavior for these new buttons.

## Verification Plan

### Automated Tests
- None (UI manual verification preferred).

### Manual Verification
- **Image Upload**: Click the image icon, select multiple images, and verify they appear in the preview area.
- **File Upload**: Click the file icon, select various file types, and verify they appear in the preview area.
- **Folder Upload**: Click the folder icon, select a folder with multiple files, and verify all files within the folder are added to the preview area.
- **Responsive Layout**: Check the input area on different screen sizes to ensure the icons don't overflow or break the layout.
