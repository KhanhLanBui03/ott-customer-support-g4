package com.chatapp.modules.myclouds.NextKeyUtils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.opencensus.trace.AttributeValue;
import lombok.Data;
import lombok.experimental.UtilityClass;
import lombok.extern.slf4j.Slf4j;
import org.apache.catalina.mapper.Mapper;

import java.io.IOException;
import java.util.Base64;
import java.util.Map;

@Slf4j
@UtilityClass
public class NextKeyUtils {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public String encode(Map<String, AttributeValue> key){
        if(key == null || key.isEmpty()){
            return null;
        }
        try {
            byte[] json = MAPPER.writeValueAsBytes(key);
            return Base64.getEncoder().encodeToString(json);
        } catch (JsonProcessingException e) {
            log.warn("Không thể encode nextKey", e);
            return null;
        }

    }

    public Map<String, AttributeValue> decode(String encoded){
        if(encoded == null || encoded.isEmpty()){
            return null;
        }
        byte[] json = Base64.getDecoder().decode(encoded);
        try {
            return MAPPER.readValue(json, new TypeReference<>() {});
        } catch (IOException e) {
            log.warn("nextKey không hợp lệ: {}", encoded);
            return null;
        }
    }
}
