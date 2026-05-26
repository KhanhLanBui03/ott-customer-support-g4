package com.chatapp.modules.myclouds.dto.response;


import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.Map;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class MyCloudPageResponse {
    List<MyCloudResponse> myCloudResponses;
    /**
     * Trả về cho client dưới dạng string (base64) để client truyền ngược lại khi request trang tiếp theo.
     * null = đã hết data (trang cuối).
     */
    String nextKey;
}
