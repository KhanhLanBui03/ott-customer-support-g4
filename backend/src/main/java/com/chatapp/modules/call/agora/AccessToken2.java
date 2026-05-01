package com.chatapp.modules.call.agora;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Base64;
import java.util.TreeMap;
import java.util.zip.Deflater;

/**
 * Agora AccessToken2 - Token builder for Agora RTC
 * Source: https://github.com/AgoraIO/Tools/tree/master/DynamicKey/AgoraDynamicKey/java
 */
public class AccessToken2 {

    public static final int VERSION = 2;
    public static final int VERSION_LENGTH = 3;

    public static final short kRtcChannelPublish = 0x0001;
    public static final short kRtcChannelSubscribe = 0x0002;

    private String appId;
    private String appCertificate;
    private int expire;
    private int issueTs;
    private int salt;
    private TreeMap<Short, ServiceBase> services;

    public AccessToken2(String appId, String appCertificate, int expire) {
        this.appId = appId;
        this.appCertificate = appCertificate;
        this.expire = expire;
        this.issueTs = (int) (System.currentTimeMillis() / 1000);
        this.salt = (int) (Math.random() * 99999999) + 1;
        this.services = new TreeMap<>();
    }

    public void addService(ServiceBase service) {
        services.put(service.getServiceType(), service);
    }

    public String build() throws Exception {
        byte[] signing = getSignature();
        byte[] data = packContent(signing);
        byte[] compressedData = compress(data);
        String base64Data = Base64.getEncoder().encodeToString(compressedData);
        return String.format("%03d%s", VERSION, base64Data);
    }

    private byte[] getSignature() throws Exception {
        byte[] signing = hmac256(appCertificate.getBytes(), intToBytes(issueTs));
        signing = hmac256(signing, intToBytes(salt));
        byte[] content = packContent(null);
        signing = hmac256(signing, content);
        return signing;
    }

    private byte[] packContent(byte[] signing) {
        ByteBuffer buffer = ByteBuffer.allocate(4096);
        buffer.order(ByteOrder.LITTLE_ENDIAN);

        // appId
        byte[] appIdBytes = appId.getBytes();
        buffer.putShort((short) appIdBytes.length);
        buffer.put(appIdBytes);

        // issueTs
        buffer.putInt(issueTs);

        // expire
        buffer.putInt(expire);

        // salt
        buffer.putInt(salt);

        // services count
        buffer.putShort((short) services.size());

        for (ServiceBase service : services.values()) {
            service.pack(buffer);
        }

        byte[] result = new byte[buffer.position()];
        buffer.rewind();
        buffer.get(result);

        if (signing != null) {
            ByteBuffer finalBuffer = ByteBuffer.allocate(2 + signing.length + result.length);
            finalBuffer.order(ByteOrder.LITTLE_ENDIAN);
            finalBuffer.putShort((short) signing.length);
            finalBuffer.put(signing);
            finalBuffer.put(result);
            byte[] finalResult = new byte[finalBuffer.position()];
            finalBuffer.rewind();
            finalBuffer.get(finalResult);
            return finalResult;
        }

        return result;
    }

    private byte[] hmac256(byte[] key, byte[] data) throws NoSuchAlgorithmException, InvalidKeyException {
        Mac sha256Hmac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKey = new SecretKeySpec(key, "HmacSHA256");
        sha256Hmac.init(secretKey);
        return sha256Hmac.doFinal(data);
    }

    private byte[] intToBytes(int value) {
        ByteBuffer buffer = ByteBuffer.allocate(4);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        buffer.putInt(value);
        return buffer.array();
    }

    private byte[] compress(byte[] data) {
        Deflater compressor = new Deflater();
        compressor.setInput(data);
        compressor.finish();
        byte[] output = new byte[data.length * 2];
        int compressedDataLength = compressor.deflate(output);
        return Arrays.copyOf(output, compressedDataLength);
    }

    // ─── Service Base ────────────────────────────────────────────────────────────

    public abstract static class ServiceBase {
        protected short serviceType;
        protected TreeMap<Short, byte[]> privileges;

        public ServiceBase(short serviceType) {
            this.serviceType = serviceType;
            this.privileges = new TreeMap<>();
        }

        public short getServiceType() {
            return serviceType;
        }

        public void addPrivilegeRtc(short privilege, int expire) {
            ByteBuffer buffer = ByteBuffer.allocate(4);
            buffer.order(ByteOrder.LITTLE_ENDIAN);
            buffer.putInt(expire);
            privileges.put(privilege, buffer.array());
        }

        public void pack(ByteBuffer buffer) {
            buffer.putShort(serviceType);
            buffer.putShort((short) privileges.size());
            for (var entry : privileges.entrySet()) {
                buffer.putShort(entry.getKey());
                buffer.putShort((short) entry.getValue().length);
                buffer.put(entry.getValue());
            }
        }
    }

    // ─── ServiceRtc ──────────────────────────────────────────────────────────────

    public static class ServiceRtc extends ServiceBase {
        public static final short kServiceTypeRtc = 1;

        private String channelName;
        private String uid;

        public ServiceRtc(String channelName, String uid) {
            super(kServiceTypeRtc);
            this.channelName = channelName;
            this.uid = uid;
        }

        @Override
        public void pack(ByteBuffer buffer) {
            byte[] channelBytes = channelName.getBytes();
            buffer.putShort(serviceType);
            buffer.putShort((short) channelBytes.length);
            buffer.put(channelBytes);
            byte[] uidBytes = uid.getBytes();
            buffer.putShort((short) uidBytes.length);
            buffer.put(uidBytes);
            buffer.putShort((short) privileges.size());
            for (var entry : privileges.entrySet()) {
                buffer.putShort(entry.getKey());
                buffer.putShort((short) entry.getValue().length);
                buffer.put(entry.getValue());
            }
        }
    }
}
