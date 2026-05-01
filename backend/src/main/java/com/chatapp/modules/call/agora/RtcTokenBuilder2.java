package com.chatapp.modules.call.agora;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Base64;
import java.util.zip.Deflater;

/**
 * Agora RTC Token Builder 2 — generates Agora token compatible with Web SDK 4.x
 *
 * Token format: "007" + Base64(Deflate(signature(2B) + signatureBytes + messageBytes))
 *
 * Reference implementation:
 * https://github.com/AgoraIO/Tools/blob/master/DynamicKey/AgoraDynamicKey/java/
 */
public class RtcTokenBuilder2 {

    public enum Role {
        ROLE_PUBLISHER(1),
        ROLE_SUBSCRIBER(2);

        private final int value;
        Role(int value) { this.value = value; }
        public int getValue() { return value; }
    }

    private static final short SERVICE_TYPE_RTC = 1;
    private static final short PRIVILEGE_JOIN_CHANNEL = 1;
    private static final short PRIVILEGE_PUBLISH_AUDIO = 2;
    private static final short PRIVILEGE_PUBLISH_VIDEO = 3;
    private static final short PRIVILEGE_PUBLISH_DATA = 4;

    /**
     * Build Agora token with string account (userId).
     */
    public String buildTokenWithUserAccount(
            String appId,
            String appCertificate,
            String channelName,
            String account,
            Role role,
            int tokenExpireInSeconds,
            int privilegeExpireInSeconds) {
        try {
            int now = (int) (System.currentTimeMillis() / 1000);
            int tokenExpire = now + tokenExpireInSeconds;
            int privExpire = now + privilegeExpireInSeconds;
            int salt = (int) (Math.random() * Integer.MAX_VALUE);

            // ─── Pack message ────────────────────────────────────────────────
            ByteBuffer msgBuf = ByteBuffer.allocate(2048).order(ByteOrder.LITTLE_ENDIAN);

            // App ID (16 bytes, fixed)
            msgBuf.putShort((short) appId.length());
            msgBuf.put(appId.getBytes());

            // Issue timestamp
            msgBuf.putInt(now);
            // Token expire
            msgBuf.putInt(tokenExpire);
            // Salt
            msgBuf.putInt(salt);

            // Number of services = 1
            msgBuf.putShort((short) 1);

            // ─── Service: RTC ────────────────────────────────────────────────
            msgBuf.putShort(SERVICE_TYPE_RTC);

            // Channel name
            byte[] channelBytes = channelName.getBytes();
            msgBuf.putShort((short) channelBytes.length);
            msgBuf.put(channelBytes);

            // Account (UID as string)
            byte[] accountBytes = account.getBytes();
            msgBuf.putShort((short) accountBytes.length);
            msgBuf.put(accountBytes);

            // Privileges
            int publishPriv = (role == Role.ROLE_PUBLISHER) ? privExpire : 0;

            // 4 privileges
            msgBuf.putShort((short) 4);

            msgBuf.putShort(PRIVILEGE_JOIN_CHANNEL);
            msgBuf.putInt(privExpire);

            msgBuf.putShort(PRIVILEGE_PUBLISH_AUDIO);
            msgBuf.putInt(publishPriv);

            msgBuf.putShort(PRIVILEGE_PUBLISH_VIDEO);
            msgBuf.putInt(publishPriv);

            msgBuf.putShort(PRIVILEGE_PUBLISH_DATA);
            msgBuf.putInt(publishPriv);

            byte[] msg = Arrays.copyOf(msgBuf.array(), msgBuf.position());

            // ─── Signing chain ───────────────────────────────────────────────
            byte[] signing = hmacSha256(appCertificate.getBytes(), toLE4(now));
            signing = hmacSha256(signing, toLE4(salt));
            signing = hmacSha256(signing, msg);

            // ─── Pack final: [signing_len(2)] + [signing] + [msg] ────────────
            ByteBuffer finalBuf = ByteBuffer.allocate(2048).order(ByteOrder.LITTLE_ENDIAN);
            finalBuf.putShort((short) signing.length);
            finalBuf.put(signing);
            finalBuf.put(msg);

            byte[] data = Arrays.copyOf(finalBuf.array(), finalBuf.position());

            // ─── Compress and encode ─────────────────────────────────────────
            byte[] compressed = deflate(data);
            return "007" + Base64.getEncoder().encodeToString(compressed);

        } catch (Exception e) {
            throw new RuntimeException("Failed to build Agora RTC token: " + e.getMessage(), e);
        }
    }

    /**
     * Build token with integer UID (0 = any).
     */
    public String buildTokenWithUid(
            String appId,
            String appCertificate,
            String channelName,
            int uid,
            Role role,
            int tokenExpireInSeconds,
            int privilegeExpireInSeconds) {
        return buildTokenWithUserAccount(
                appId, appCertificate, channelName,
                uid == 0 ? "0" : String.valueOf(uid),
                role, tokenExpireInSeconds, privilegeExpireInSeconds);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private byte[] toLE4(int value) {
        return ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(value).array();
    }

    private byte[] hmacSha256(byte[] key, byte[] data) throws NoSuchAlgorithmException, InvalidKeyException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private byte[] deflate(byte[] input) {
        Deflater deflater = new Deflater();
        deflater.setInput(input);
        deflater.finish();
        byte[] out = new byte[input.length + 256];
        int len = deflater.deflate(out);
        deflater.end();
        return Arrays.copyOf(out, len);
    }
}
