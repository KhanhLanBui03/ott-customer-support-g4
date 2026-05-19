import React from 'react';
import { useLanguageSettings } from '../../hooks/useLanguageSettings';

const LanguageSettings = () => {
    const { preferredLanguage, updateLanguage, disableTranslation, loading, LANGUAGES } = useLanguageSettings();

    return (
        <div className="settings-section">
            <h3>Ngôn ngữ hiển thị</h3>
            <p className="hint">
                Tin nhắn từ người khác sẽ tự động dịch sang ngôn ngữ bạn chọn.
            </p>

            {/* Tắt dịch */}
            <div
                className={`lang-option ${!preferredLanguage ? "active" : ""}`}
                onClick={disableTranslation}
            >
                <span>🚫</span>
                <span>Tắt tự động dịch</span>
                {!preferredLanguage && <span className="check">✓</span>}
            </div>

            {/* Danh sách ngôn ngữ */}
            {LANGUAGES.map(lang => (
                <div
                    key={lang.code}
                    className={`lang-option ${preferredLanguage === lang.code ? "active" : ""}`}
                    onClick={() => updateLanguage(lang.code)}
                >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                    {preferredLanguage === lang.code && <span className="check">✓</span>}
                </div>
            ))}

            {loading && <p className="saving">Đang lưu...</p>}
        </div>
    );
};

export default LanguageSettings;
