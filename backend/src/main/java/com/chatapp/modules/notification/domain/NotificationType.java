package com.chatapp.modules.notification.domain;

public enum NotificationType {
    FRIEND_REQUEST,
    FRIEND_ACCEPTED,
    MESSAGE,
    OTHER;

    public static NotificationType fromString(String value) {
        for (NotificationType t : values()) {
            if (t.name().equalsIgnoreCase(value)) return t;
        }
        return OTHER;
    }

//    public static String toString(NotificationType value) {
//        for (NotificationType t : values()) {
//            if (t.name().equalsIgnoreCase(value.name())) return t.name();
//        }
//        return OTHER.name();
//    }
}
