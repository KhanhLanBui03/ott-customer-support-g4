package com.chatapp.modules.myclouds.mapper;

import com.chatapp.modules.myclouds.domain.MyCloud;
import com.chatapp.modules.myclouds.dto.response.MyCloudResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

import java.util.List;

@Mapper(componentModel = "spring",
unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface MyCloudMapper {

    MyCloudResponse toMyCloudResponse(MyCloud myCloud);
    List<MyCloudResponse> toResponses(List<MyCloud> entities);
}
