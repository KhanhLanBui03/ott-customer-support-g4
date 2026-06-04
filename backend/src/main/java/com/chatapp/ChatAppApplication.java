package com.chatapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main Spring Boot Application class for ChatApp
 * Real-time chat application with WebSocket, JWT auth, DynamoDB
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class ChatAppApplication {

    @org.springframework.beans.factory.annotation.Autowired
    private com.chatapp.modules.auth.repository.UserRepository userRepository;

    public static void main(String[] args) {
        loadEnvFile();
        SpringApplication.run(ChatAppApplication.class, args);
        System.out.println("🚀 ChatApp Backend started successfully!");
        System.out.println("📡 WebSocket endpoints: ws://localhost:8080/ws/chat, ws://localhost:8080/ws/notifications");
        System.out.println("📚 Swagger UI: http://localhost:8080/swagger-ui.html");
        System.out.println("🏥 Health check: http://localhost:8080/actuator/health");
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    @org.springframework.scheduling.annotation.Async
    public void onApplicationReady() {
        System.out.println("🚀 ChatApp Backend is ready and healthy!");
    }

    private static void loadEnvFile() {
        List<Path> candidates = List.of(
                Path.of("../.env"),
                Path.of(".env"));

        for (Path candidate : candidates) {
            if (!Files.exists(candidate)) {
                continue;
            }

            try {
                for (String rawLine : Files.readAllLines(candidate)) {
                    String line = rawLine.trim();
                    if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) {
                        continue;
                    }

                    int separatorIndex = line.indexOf('=');
                    String key = line.substring(0, separatorIndex).trim();
                    String value = line.substring(separatorIndex + 1).trim();

                    if (key.isEmpty()) {
                        continue;
                    }

                    // Always prioritize .env values for AI configuration to avoid stale system env
                    // vars
                    System.setProperty(key, value);
                }
                System.out.println("✅ Loaded environment variables from: " + candidate.toAbsolutePath());
                String apiKey = System.getProperty("GEMINI_API_KEY");
                if (apiKey != null && apiKey.length() > 8) {
                    String[] keys = apiKey.split(",");
                    System.out.println("🔑 Gemini API Keys loaded: " + keys.length + " key(s) detected.");
                    for (int i = 0; i < keys.length; i++) {
                        String k = keys[i].trim();
                        if (k.length() > 8) {
                            System.out.println("   -> Key [" + (i + 1) + "]: " + k.substring(0, 4) + "..." + k.substring(k.length() - 4));
                        }
                    }
                }
                return;
            } catch (IOException ex) {
                System.err.println("Failed to load .env from " + candidate.toAbsolutePath() + ": " + ex.getMessage());
            }
        }
    }
}
