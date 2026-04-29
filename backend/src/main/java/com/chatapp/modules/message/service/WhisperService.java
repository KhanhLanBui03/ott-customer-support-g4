package com.chatapp.modules.message.service;

import com.chatapp.modules.message.command.MultipartInputStreamFileResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpHeaders;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;

@Service
public class WhisperService {

    public String transcribe(MultipartFile file) {
        try {
            String url = "http://localhost:8000/transcribe";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new MultipartInputStreamFileResource(
                    file.getInputStream(),
                    file.getOriginalFilename()
            ));

            HttpEntity<MultiValueMap<String, Object>> request =
                    new HttpEntity<>(body, headers);

            RestTemplate restTemplate = new RestTemplate();

            ResponseEntity<Map> response =
                    restTemplate.postForEntity(url, request, Map.class);

            return response.getBody().get("text").toString();

        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
