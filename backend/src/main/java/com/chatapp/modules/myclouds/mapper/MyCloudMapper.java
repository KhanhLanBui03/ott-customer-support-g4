package com.chatapp.modules.myclouds.mapper;

import com.chatapp.modules.myclouds.domain.MyCloud;
import com.chatapp.modules.myclouds.dto.response.MyCloudResponse;
import com.chatapp.modules.myclouds.extraFunctions.SettingUpS3;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

@Mapper(componentModel = "spring",
unmappedTargetPolicy = ReportingPolicy.ERROR)
public abstract class MyCloudMapper {

    @Autowired
    protected SettingUpS3 settingUpS3;

    @Mapping(target = "fileUrl", expression = "java(settingUpS3.generatePresignedUrl(myCloud.getS3Key()))")
    public abstract MyCloudResponse toMyCloudResponse(MyCloud myCloud);

    public abstract List<MyCloudResponse> toResponses(List<MyCloud> entities);
}
