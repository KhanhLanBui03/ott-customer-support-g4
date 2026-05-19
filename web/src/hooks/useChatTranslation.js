import { useState, useEffect } from "react";
import { chatApi } from "../api/chatApi";
import { useLanguageSettings } from "./useLanguageSettings";
import { useSelector } from "react-redux";

const useChatTranslation = (messages, conversationId) => {
    const { preferredLanguage } = useLanguageSettings();
    const [translations, setTranslations] = useState({});
    const currentUser = useSelector(state => state.auth.user);


    useEffect(() => {
        if (!preferredLanguage || !messages.length) return;

        const untranslated = messages.filter(m =>
            m.type === "TEXT" &&
            !m.isRecalled &&
            !translations[m.messageId] &&
            m.senderId !== currentUser.userId
        );

        if (!untranslated.length) return;

        const needTranslate = untranslated.filter(m => {
            const senderLang = m.senderPreferredLanguage;
            return senderLang && senderLang !== preferredLanguage;
        });

        if (!needTranslate.length) return;

        chatApi.post("/messages/translate/batch", {
            conversationId: conversationId,
            messageIds: needTranslate.map(m => m.messageId),
            srcLang: needTranslate[0].senderPreferredLanguage,
            tgtLang: preferredLanguage
        }).then(res => {
            setTranslations(prev => ({ ...prev, ...res.data.data }));
        });

    }, [messages, preferredLanguage, currentUser.userId, conversationId]);

    const getDisplayText = (message) =>
        translations[message.messageId] || message.content;

    return { getDisplayText, translations };
};

export default useChatTranslation;
