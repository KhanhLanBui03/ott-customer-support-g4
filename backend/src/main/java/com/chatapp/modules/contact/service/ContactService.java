package com.chatapp.modules.contact.service;

import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.contact.dto.ContactResponse;
import com.chatapp.modules.contact.dto.SyncContactsRequest;
import com.chatapp.common.util.ValidationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ContactService {

    private final UserRepository userRepository;
    private final ValidationUtil validationUtil;

    public List<ContactResponse> syncContacts(SyncContactsRequest request) {
        List<ContactResponse> matchedContacts = new ArrayList<>();
        
        if (request.getPhoneNumbers() == null || request.getPhoneNumbers().isEmpty()) {
            return matchedContacts;
        }

        for (String phone : request.getPhoneNumbers()) {
            try {
                String cleanPhone = validationUtil.cleanPhoneNumber(phone);
                Optional<User> userOpt = userRepository.findByPhoneNumber(cleanPhone);
                
                if (userOpt.isPresent() && Boolean.TRUE.equals(userOpt.get().getIsVerified())) {
                    User user = userOpt.get();
                    matchedContacts.add(ContactResponse.builder()
                            .userId(user.getUserId())
                            .phoneNumber(user.getPhoneNumber())
                            .fullName(user.getFullName())
                            .avatarUrl(user.getAvatarUrl())
                            .build());
                }
            } catch (Exception e) {
                // Ignore invalid numbers during sync
            }
        }
        
        return matchedContacts;
    }
}
