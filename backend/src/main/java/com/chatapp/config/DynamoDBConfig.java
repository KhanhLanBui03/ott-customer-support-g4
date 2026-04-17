package com.chatapp.config;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * DynamoDB Configuration
 * Sets up connection to DynamoDB (local or AWS)
 */
@Configuration
@Slf4j
public class DynamoDBConfig {

    @Value("${aws.region:ap-southeast-1}")
    private String awsRegion;

    @Value("${aws.dynamodb.endpoint:}")
    private String dynamoDBEndpoint;

    @Value("${aws.accessKey:}")
    private String accessKey;

    @Value("${aws.secretKey:}")
    private String secretKey;

    /**
     * Create AmazonDynamoDB client
     */
    @Bean
    public AmazonDynamoDB amazonDynamoDB() {
        log.info("Creating DynamoDB client for region: {}", awsRegion);

        AmazonDynamoDBClientBuilder builder = AmazonDynamoDBClientBuilder.standard();

        // Use local endpoint if configured (for development)
        if (dynamoDBEndpoint != null && !dynamoDBEndpoint.isEmpty()) {
            log.info("Using DynamoDB local endpoint: {}", dynamoDBEndpoint);
            builder.withEndpointConfiguration(
                    new AwsClientBuilder.EndpointConfiguration(dynamoDBEndpoint, awsRegion)
            );
        } else {
            builder.withRegion(awsRegion);
        }

        // Use credentials if provided
        if (accessKey != null && !accessKey.isEmpty() && secretKey != null && !secretKey.isEmpty()) {
            BasicAWSCredentials credentials = new BasicAWSCredentials(accessKey, secretKey);
            builder.withCredentials(new AWSStaticCredentialsProvider(credentials));
        }

        return builder.build();
    }

    /**
     * Create DynamoDBMapper for ORM operations
     */
    @Bean
    public DynamoDBMapper dynamoDBMapper(AmazonDynamoDB amazonDynamoDB) {
        log.info("Creating DynamoDBMapper");
        return new DynamoDBMapper(amazonDynamoDB);
    }
}
