package com.chatapp.modules.myclouds.dto.response;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MyCloudPageResponse {
    List<MyCloudResponse> myCloudResponses;

}
