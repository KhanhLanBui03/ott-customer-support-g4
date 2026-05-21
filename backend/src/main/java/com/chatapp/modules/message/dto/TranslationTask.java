package com.chatapp.modules.message.dto;

import lombok.Getter;

import java.util.concurrent.CompletableFuture;
@Getter
public class TranslationTask {
    private final String text;
    private final String srcLang;
    private final String tgtLang;
    private final CompletableFuture<String> future = new CompletableFuture<>();

    public TranslationTask(String text, String srcLang, String tgtLang) {
        this.text    = text;
        this.srcLang = srcLang;
        this.tgtLang = tgtLang;
    }
}
