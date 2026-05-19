import { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";
import i18n, { LANGUAGE_MAP } from "../i18n";

const LANGUAGES = [
    { code: "vie_Latn", label: "Tiếng Việt", flag: "🇻🇳" },
    { code: "eng_Latn", label: "English", flag: "🇬🇧" },
    { code: "zho_Hans", label: "中文", flag: "🇨🇳" },
    { code: "jpn_Jpan", label: "日本語", flag: "🇯🇵" },
    { code: "kor_Hang", label: "한국어", flag: "🇰🇷" },
    { code: "fra_Latn", label: "Français", flag: "🇫🇷" },
];

export const useLanguageSettings = (isOpen) => {
    const [preferredLanguage, setPreferredLanguage] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            axiosClient.get("/settings/language")
                .then(res => {
                    // Dựa trên log: res.data đã là { preferredLanguage: "eng_Latn" }
                    // Hoặc res.data.data là { preferredLanguage: "eng_Latn" }
                    const responseBody = res.data;
                    let langData = null;

                    if (responseBody?.data?.preferredLanguage) {
                        langData = responseBody.data.preferredLanguage;
                    } else if (responseBody?.preferredLanguage) {
                        langData = responseBody.preferredLanguage;
                    }
                    
                    const normalized = (langData === "" || langData === undefined || langData === "null") ? null : langData;
                    
                    console.log("=== DEBUG LANGUAGE SETTINGS ===");
                    console.log("Full res.data:", responseBody);
                    console.log("Extracted langData:", langData);
                    console.log("Normalized value:", normalized);
                    
                    setPreferredLanguage(normalized);
                    setSelectedLanguage(normalized);

                    // Thay đổi ngôn ngữ i18n nếu có trong map
                    if (normalized && LANGUAGE_MAP[normalized]) {
                        i18n.changeLanguage(LANGUAGE_MAP[normalized]);
                    }
                })
                .catch(err => {
                    console.error("Failed to fetch language settings", err);
                });
        }
    }, [isOpen]);

    const updateLanguage = async () => {
        setLoading(true);
        try {
            await axiosClient.put("/settings/language", { preferredLanguage: selectedLanguage });
            setPreferredLanguage(selectedLanguage);
            
            // Cập nhật i18n ngay lập tức khi lưu thành công
            if (selectedLanguage && LANGUAGE_MAP[selectedLanguage]) {
                i18n.changeLanguage(LANGUAGE_MAP[selectedLanguage]);
            }
            
            return true;
        } catch (error) {
            console.error("Failed to update language", error);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleSelectLanguage = (langCode) => setSelectedLanguage(langCode);

    return { 
        preferredLanguage, 
        selectedLanguage, 
        handleSelectLanguage, 
        updateLanguage, 
        loading, 
        LANGUAGES 
    };
};
