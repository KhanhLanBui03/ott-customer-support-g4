package com.chatapp.modules.myclouds.NextKeyUtils;

import lombok.experimental.UtilityClass;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@UtilityClass
public class NextKeyUtils {
    
    public String encode(String documentId) {
        if (documentId == null || documentId.isEmpty()) {
            return null;
        }
        return Base64.getEncoder().encodeToString(documentId.getBytes(StandardCharsets.UTF_8));
    }

    public String decode(String encoded) {
        if (encoded == null || encoded.isEmpty()) {
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(encoded);
            return new String(decoded, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
