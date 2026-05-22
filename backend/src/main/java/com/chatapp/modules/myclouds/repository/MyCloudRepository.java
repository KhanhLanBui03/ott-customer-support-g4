package com.chatapp.modules.myclouds.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.chatapp.modules.myclouds.domain.MyCloud;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
@FieldDefaults(makeFinal = true, level = lombok.AccessLevel.PRIVATE)
public class MyCloudRepository {
    DynamoDBMapper dynamoDBMapper;

    public MyCloud save(MyCloud myCloud){
        dynamoDBMapper.save(myCloud);
        return myCloud;
    }


}
