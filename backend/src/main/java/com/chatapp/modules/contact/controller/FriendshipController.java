package com.chatapp.modules.contact.controller;

import com.chatapp.modules.contact.dto.FriendshipRequest;
import com.chatapp.modules.contact.dto.FriendshipResponse;
import com.chatapp.modules.contact.service.FriendshipService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/friends")
@RequiredArgsConstructor
public class FriendshipController {

    private final FriendshipService friendshipService;

    @PostMapping("/request")
    public ResponseEntity<Void> sendRequest(@RequestBody FriendshipRequest request) {
        String userId = getCurrentUserId();
        friendshipService.sendFriendRequest(userId, request.getFriendId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/accept/{requesterId}")
    public ResponseEntity<Void> acceptRequest(@PathVariable String requesterId) {
        String userId = getCurrentUserId();
        friendshipService.acceptFriendRequest(requesterId, userId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reject/{requesterId}")
    public ResponseEntity<Void> rejectRequest(@PathVariable String requesterId) {
        String userId = getCurrentUserId();
        friendshipService.rejectFriendRequest(requesterId, userId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/block/{friendId}")
    public ResponseEntity<Void> blockUser(@PathVariable String friendId) {
        String userId = getCurrentUserId();
        friendshipService.blockUser(userId, friendId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/unblock/{friendId}")
    public ResponseEntity<Void> unblockUser(@PathVariable String friendId) {
        String userId = getCurrentUserId();
        friendshipService.unblockUser(userId, friendId);
        return ResponseEntity.ok().build();
    }

    @GetMapping
    public ResponseEntity<List<FriendshipResponse>> getFriends() {
        return ResponseEntity.ok(friendshipService.getFriends(getCurrentUserId()));
    }

    @GetMapping("/pending")
    public ResponseEntity<List<FriendshipResponse>> getPending() {
        return ResponseEntity.ok(friendshipService.getPendingRequests(getCurrentUserId()));
    }

    private String getCurrentUserId() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
