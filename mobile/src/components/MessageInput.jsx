import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Dimensions,
  LayoutAnimation,
  Keyboard,
  ScrollView,
} from 'react-native';



import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { clearReplyingTo } from '../store/chatSlice';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { mediaApi } from '../api/chatApi';
import CONFIG from '../config';
import { Audio } from 'expo-av';
import PermissionModal from './common/PermissionModal';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';



const { width: SCREEN_WIDTH } = Dimensions.get('window');

const emojiCategories = [
  { id: 'smileys', label: '😀', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'] },
  { id: 'gestures', label: '👋', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄'] },
  { id: 'animals', label: '🐶', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦢', '🦉', '🦩', '🦚', '🦜', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖', '🐳', '🐋', '🐬', '🐟', '🐠', '🐡', '🦈', '🐙', '🐚', '🦀', '🦞', '🦐', '🦑'] },
  { id: 'food', label: '🍏', emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '👝', '🍟', '🍔', '🍕', '🌭', '🥪', '🌮', '🌯', '🥗', '🥘', '🍲', '🍱', '🥣', '🍛', '🍜', '🍜', '🍝', '🍠', '🍤', '🍣', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '☕', '🍵', '🍶', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃'] },
  { id: 'activities', label: '⚽', emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '⛸️', '🎿', '🛷', '🥌', '🎯', '🪀', '🎮', '🕹️', '🎰', '🎲', '🧩', '🧸', '♠️', '♥️', '♦️', '♣️', '♟️', '🃏', '🀄', '🎴', '🎭', '🎨', '🧵', '🧶'] },
  { id: 'objects', label: '💡', emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧼', '🧽', '🪒', '🧺', '🧹', '🌡️', '🏷️', '🔖'] },
  { id: 'symbols', label: '❤️', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '🤖', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤'] }
];

const stickerSets = [
  { id: 'trending', label: '🔥' },
  { id: 'cute', label: '🐱' },
  { id: 'funny', label: '🤣' },
  { id: 'love', label: '❤️' },
  { id: 'cry', label: '😢' },
  { id: 'angry', label: '😡' },
  { id: 'pepe', label: '🐸' }
];

const MessageInput = forwardRef(({ onSendMessage, isLoading = false, onTypingChange, conversationType, onOpenPoll, members = [] }, ref) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadType, setUploadType] = useState(null); // 'MEDIA' or 'FILE'
  const [isTyping, setIsTyping] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const typingTimeoutRef = useRef(null);
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { replyingTo } = useSelector(state => state.chat);
  const currentUserId = user?.userId || user?.id;


  // Voice recording state
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Mention states
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionResults, setMentionResults] = useState([]);
  const [cursorPosition, setCursorPosition] = useState(0);

  const [permissionModal, setPermissionModal] = useState({
    visible: false,
    type: 'camera',
    onConfirm: () => { },
    onCancel: () => setPermissionModal(prev => ({ ...prev, visible: false }))
  });

  // Emoji/Sticker/GIF states
  const [showEmojis, setShowEmojis] = useState(false);
  const [isEmojiExpanded, setIsEmojiExpanded] = useState(false);
  const [emojiSearchTerm, setEmojiSearchTerm] = useState('');
  const [gifs, setGifs] = useState([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [stickersLoading, setStickersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('emoji'); // 'emoji', 'sticker', 'gif'
  const [activeCategory, setActiveCategory] = useState('smileys');

  // Dismiss emojis on system keyboard open
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setShowEmojis(false);
      setIsEmojiExpanded(false);
    });
    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  // Fetch Stickers from Tenor API
  useEffect(() => {
    if (!showEmojis || activeTab !== 'sticker') return;

    let isMounted = true;
    const fetchStickers = async () => {
      setStickersLoading(true);
      try {
        let url = 'https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=20&searchfilter=sticker';
        const query = emojiSearchTerm.trim() || activeCategory;
        if (query && query !== 'trending') {
          url = `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=20&searchfilter=sticker`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (isMounted && data.results) {
          const formatted = data.results.map(item => ({
            id: item.id,
            url: item.media[0]?.gif?.url || item.url,
            previewUrl: item.media[0]?.tinygif?.url || item.media[0]?.gif?.url || item.url,
            title: item.title || item.content_description || 'Sticker'
          }));
          setStickers(formatted);
        }
      } catch (err) {
        console.error('Failed to fetch Tenor stickers on mobile:', err);
      } finally {
        if (isMounted) setStickersLoading(false);
      }
    };

    const timer = setTimeout(fetchStickers, emojiSearchTerm.trim() ? 500 : 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [showEmojis, activeTab, emojiSearchTerm, activeCategory]);

  // Fetch GIFs from Tenor API
  useEffect(() => {
    if (!showEmojis || activeTab !== 'gif') return;

    let isMounted = true;
    const fetchGifs = async () => {
      setGifsLoading(true);
      try {
        let url = 'https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=20';
        if (emojiSearchTerm.trim()) {
          url = `https://g.tenor.com/v1/search?q=${encodeURIComponent(emojiSearchTerm.trim())}&key=LIVDSRZULELA&limit=20`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (isMounted && data.results) {
          const formatted = data.results.map(item => ({
            id: item.id,
            url: item.media[0]?.gif?.url || item.url,
            previewUrl: item.media[0]?.tinygif?.url || item.media[0]?.gif?.url || item.url,
            title: item.title || item.content_description || 'GIF'
          }));
          setGifs(formatted);
        }
      } catch (err) {
        console.error('Failed to fetch Tenor GIFs on mobile:', err);
      } finally {
        if (isMounted) setGifsLoading(false);
      }
    };

    const timer = setTimeout(fetchGifs, emojiSearchTerm.trim() ? 500 : 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [showEmojis, activeTab, emojiSearchTerm]);

  const handleToggleEmojis = () => {
    if (!showEmojis) {
      Keyboard.dismiss();
      setShowEmojis(true);
    } else {
      setShowEmojis(false);
      setIsEmojiExpanded(false);
    }
  };

  const handleSendSticker = (stickerUrl) => {
    onSendMessage(stickerUrl, replyingTo?.messageId, 'STICKER', []);
    setShowEmojis(false);
  };

  const handleSendGif = (gifUrl) => {
    onSendMessage('', replyingTo?.messageId, 'IMAGE', [gifUrl]);
    setShowEmojis(false);
  };

  const handleEmojiPress = (emoji) => {
    setMessage(prev => prev + emoji);
  };

  const renderEmojiPanel = () => {
    const panelHeight = isEmojiExpanded ? 500 : 310;
    return (
      <View style={[styles.emojiPanelContainer, { height: panelHeight, backgroundColor: isDark ? colors.surface200 : colors.background, borderTopColor: colors.border }]}>
        {/* Expand Handle */}
        <TouchableOpacity
          style={styles.expandHandleContainer}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsEmojiExpanded(!isEmojiExpanded);
          }}
        >
          <View style={[styles.expandHandle, { backgroundColor: colors.border }]} />
        </TouchableOpacity>

        {/* Tab Header: Emoji, Sticker, GIF */}
        <View style={[styles.emojiTabHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.emojiTabButton, activeTab === 'emoji' && { borderBottomColor: colors.primary }]}
            onPress={() => {
              setActiveTab('emoji');
              setActiveCategory('smileys');
              setEmojiSearchTerm('');
            }}
          >
            <Text style={[styles.emojiTabText, { color: activeTab === 'emoji' ? colors.primary : colors.textSubtle }]}>Emoji</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.emojiTabButton, activeTab === 'sticker' && { borderBottomColor: colors.primary }]}
            onPress={() => {
              setActiveTab('sticker');
              setActiveCategory('trending');
              setEmojiSearchTerm('');
            }}
          >
            <Text style={[styles.emojiTabText, { color: activeTab === 'sticker' ? colors.primary : colors.textSubtle }]}>Sticker</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.emojiTabButton, activeTab === 'gif' && { borderBottomColor: colors.primary }]}
            onPress={() => {
              setActiveTab('gif');
              setEmojiSearchTerm('');
            }}
          >
            <Text style={[styles.emojiTabText, { color: activeTab === 'gif' ? colors.primary : colors.textSubtle }]}>GIF</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.emojiSearchContainer, { backgroundColor: colors.input }]}>
          <MaterialIcons name="search" size={20} color={colors.textSubtle} />
          <TextInput
            style={[styles.emojiSearchInput, { color: colors.foreground }]}
            placeholder={
              activeTab === 'emoji'
                ? t('chat.search_emoji_placeholder')
                : activeTab === 'sticker'
                  ? t('chat.search_placeholder', { type: 'sticker' })
                  : t('chat.search_placeholder', { type: 'GIF' })
            }
            placeholderTextColor={colors.textSubtle}
            value={emojiSearchTerm}
            onChangeText={setEmojiSearchTerm}
          />
          {emojiSearchTerm !== '' && (
            <TouchableOpacity onPress={() => setEmojiSearchTerm('')}>
              <MaterialIcons name="cancel" size={20} color={colors.textSubtle} />
            </TouchableOpacity>
          )}
        </View>

        {/* Panel Content Scroll Area */}
        <View style={styles.emojiPanelContent}>
          {activeTab === 'emoji' && (
            <ScrollView contentContainerStyle={styles.emojiGrid}>
              {((emojiCategories.find(c => c.id === activeCategory) || emojiCategories[0]).emojis)
                .filter(e => emojiSearchTerm === '' || e.includes(emojiSearchTerm))
                .map((emoji, i) => (
                  <TouchableOpacity
                    key={`${emoji}-${i}`}
                    onPress={() => handleEmojiPress(emoji)}
                    style={styles.emojiCell}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}

          {activeTab === 'sticker' && (
            stickersLoading && stickers.length === 0 ? (
              <View style={styles.panelLoadingContainer}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            ) : stickers.length === 0 ? (
              <View style={styles.panelLoadingContainer}>
                <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
                  {stickersLoading ? t('chat.searching') : t('chat.no_stickers_found')}
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.stickerGrid}>
                {stickers.map((sticker) => (
                  <TouchableOpacity
                    key={sticker.id}
                    onPress={() => handleSendSticker(sticker.url)}
                    style={styles.stickerCell}
                  >
                    <Image source={{ uri: sticker.previewUrl }} style={styles.stickerImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )
          )}

          {activeTab === 'gif' && (
            gifsLoading && gifs.length === 0 ? (
              <View style={styles.panelLoadingContainer}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            ) : gifs.length === 0 ? (
              <View style={styles.panelLoadingContainer}>
                <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
                  {gifsLoading ? t('chat.searching') : t('chat.no_gifs_found')}
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.gifGrid}>
                {gifs.map((gif) => (
                  <TouchableOpacity
                    key={gif.id}
                    onPress={() => handleSendGif(gif.url)}
                    style={styles.gifCell}
                  >
                    <Image source={{ uri: gif.previewUrl }} style={styles.gifImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )
          )}
        </View>

        {/* Category Sub-Bar */}
        {(activeTab === 'emoji' || activeTab === 'sticker') && (
          <View style={[styles.categorySubBar, { borderTopColor: colors.border, backgroundColor: colors.input }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categorySubBarScroll}>
              {activeTab === 'emoji' && emojiCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categorySubButton, activeCategory === category.id && { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.1)' }]}
                  onPress={() => setActiveCategory(category.id)}
                >
                  <Text style={styles.categorySubLabel}>{category.label}</Text>
                </TouchableOpacity>
              ))}
              {activeTab === 'sticker' && stickerSets.map((set) => (
                <TouchableOpacity
                  key={set.id}
                  style={[styles.categorySubButton, activeCategory === set.id && { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.1)' }]}
                  onPress={() => setActiveCategory(set.id)}
                >
                  <Text style={styles.categorySubLabel}>{set.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };
  const isPickingRef = useRef(false);

  const BASE_URL = CONFIG.BASE_URL;

  useImperativeHandle(ref, () => ({
    insertMention: (user) => {
      const mentionText = `@${user.fullName || user.name} `;
      setMessage(prev => {
        // Nếu đã có nội dung, thêm dấu cách nếu cần
        if (prev && !prev.endsWith(' ')) return prev + ' ' + mentionText;
        return prev + mentionText;
      });
    }
  }));

  useEffect(() => {

    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const granted = await requestPermission('mic', () => Audio.requestPermissionsAsync());
      if (!granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Explicit options for m4a (AAC)
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Upload and send
      if (uri) {
        setIsUploading(true);
        const extension = uri.split('.').pop();
        const fileName = `voice_${Date.now()}.${extension}`;
        const file = {
          uri,
          type: extension === 'm4a' ? 'audio/mp4' : `audio/${extension}`,
          name: fileName,
        };

        try {
          const response = await mediaApi.uploadFile(file);
          const url = response.data?.data?.url || response.data?.url || response.url;
          if (url) {
            onSendMessage('', replyingTo?.messageId, 'VOICE', [url]);
            dispatch(clearReplyingTo());
          }
        } catch (uploadErr) {
          console.error('Voice upload failed', uploadErr);
        } finally {
          setIsUploading(false);
        }
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      setRecording(null);
    } catch (err) {
      console.error('Failed to cancel recording', err);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleChange = (text) => {
    setMessage(text);

    // Logic detect mention (cả có @ và không có @)
    if (conversationType === 'GROUP') {
      const lastAtPos = text.lastIndexOf('@', cursorPosition - 1);

      // Trường hợp 1: Có ký tự @ chủ động
      if (lastAtPos !== -1 && !text.slice(lastAtPos, cursorPosition).includes(' ')) {
        const textAfterAt = text.slice(lastAtPos + 1, cursorPosition);
        if (textAfterAt.length < 20) {
          setMentionQuery(textAfterAt);
          const filtered = members.filter(m => {
            const name = m.fullName || m.name || '';
            const isAlreadyMentioned = text.includes(`@${name}`);
            return (
              name.toLowerCase().includes(textAfterAt.toLowerCase()) &&
              String(m.userId || m.id) !== String(currentUserId) &&
              !isAlreadyMentioned
            );
          });
          setMentionResults(filtered);
          setShowMentions(filtered.length > 0);
          return; // Thoát sớm nếu đã xử lý theo @
        }
      }

      // Trường hợp 2: Không có @ - Tự động gợi ý theo từ đang gõ
      const words = text.slice(0, cursorPosition).split(/\s/);
      const currentWord = words[words.length - 1];

      if (currentWord.length >= 2) {
        setMentionQuery(currentWord);
        const filtered = members.filter(m => {
          const name = m.fullName || m.name || '';
          const isAlreadyMentioned = text.includes(`@${name}`);
          return (
            name.toLowerCase().includes(currentWord.toLowerCase()) &&
            String(m.userId || m.id) !== String(currentUserId) &&
            !isAlreadyMentioned
          );

        });
        setMentionResults(filtered);
        setShowMentions(filtered.length > 0);
      } else {
        setShowMentions(false);
        setMentionQuery('');
      }
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }



    if (text.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
        onTypingChange && onTypingChange(true);
      }

      // Reset timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTypingChange && onTypingChange(false);
        typingTimeoutRef.current = null;
      }, 3000);
    } else {
      if (isTyping) {
        setIsTyping(false);
        onTypingChange && onTypingChange(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
    }
  };

  const handleSelectMention = (member) => {
    const lastAtPos = message.lastIndexOf('@', cursorPosition - 1);
    const name = member.fullName || member.name;

    if (lastAtPos !== -1 && !message.slice(lastAtPos, cursorPosition).includes(' ')) {
      // Thay thế cho trường hợp có @
      const beforeAt = message.slice(0, lastAtPos);
      const afterCursor = message.slice(cursorPosition);
      const newMessage = `${beforeAt}@${name} ${afterCursor}`;
      setMessage(newMessage);
    } else {
      // Thay thế cho trường hợp gõ tên trực tiếp
      const words = message.slice(0, cursorPosition).split(/\s/);
      const currentWord = words[words.length - 1];
      const beforeWord = message.slice(0, cursorPosition - currentWord.length);
      const afterCursor = message.slice(cursorPosition);
      const newMessage = `${beforeWord}@${name} ${afterCursor}`;
      setMessage(newMessage);
    }
    setShowMentions(false);
  };



  const requestPermission = async (type, nativeRequest) => {
    let checkFunc;
    if (type === 'camera') checkFunc = () => ImagePicker.getCameraPermissionsAsync();
    else if (type === 'gallery') checkFunc = () => ImagePicker.getMediaLibraryPermissionsAsync();
    else if (type === 'mic') checkFunc = () => Audio.getPermissionsAsync();

    console.log(`[Permission] Requesting ${type}...`);
    if (checkFunc) {
      const { status, canAskAgain } = await checkFunc();
      console.log(`[Permission] Current status for ${type}: ${status}`);
      if (status === 'granted') return true;

      if (status === 'denied' && !canAskAgain) {
        Alert.alert(t('chat.permission_denied_title'), t('chat.permission_denied_desc'));
        return false;
      }
    }

    console.log(`[Permission] Showing custom modal for ${type}`);
    return new Promise((resolve) => {
      setPermissionModal({
        visible: true,
        type,
        onConfirm: async () => {
          console.log(`[Permission] User confirmed modal for ${type}`);
          setPermissionModal(prev => ({ ...prev, visible: false }));
          const { status } = await nativeRequest();
          console.log(`[Permission] Native request result for ${type}: ${status}`);
          resolve(status === 'granted');
        },
        onCancel: () => {
          console.log(`[Permission] User cancelled modal for ${type}`);
          setPermissionModal(prev => ({ ...prev, visible: false }));
          resolve(false);
        }
      });
    });
  };

  const takePhoto = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    console.log('[Camera] Starting takePhoto process');
    try {
      const granted = await requestPermission('camera', () => ImagePicker.requestCameraPermissionsAsync());
      if (!granted) {
        console.log('[Camera] Permission denied');
        isPickingRef.current = false;
        return;
      }

      // Wait for modal to close fully
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[Camera] Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('[Camera] Photo/Video taken successfully');
        setIsUploading(true);
        setUploadType('MEDIA');
        const asset = result.assets[0];

        let fileName = asset.fileName || (asset.type === 'video' ? 'video.mp4' : 'camera_image.jpg');
        const file = {
          uri: asset.uri,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          name: fileName,
        };

        try {
          const response = await mediaApi.uploadFile(file);
          const url = response.data?.data?.url || response.data?.url || response.url;
          if (url) {
            onSendMessage('', replyingTo?.messageId, asset.type === 'video' ? 'VIDEO' : 'IMAGE', [url]);
            dispatch(clearReplyingTo());
          }
        } catch (uploadErr) {
          console.error('[Camera] Upload failed', uploadErr);
          Alert.alert(t('common.error'), t('chat.camera_upload_error'));
        }
      } else {
        console.log('[Camera] Operation cancelled by user');
      }
    } catch (error) {
      console.error('[Camera] takePhoto error:', error);
    } finally {
      console.log('[Camera] Resetting states in finally');
      setIsUploading(false);
      setUploadType(null);
      isPickingRef.current = false;
    }
  };

  const pickMedia = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    console.log('[Gallery] Starting pickMedia process');
    try {
      const granted = await requestPermission('gallery', () => ImagePicker.requestMediaLibraryPermissionsAsync());
      if (!granted) {
        console.log('[Gallery] Permission denied');
        isPickingRef.current = false;
        return;
      }

      // Wait for modal to close
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[Gallery] Launching media library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log(`[Gallery] Selected ${result.assets.length} items`);
        setIsUploading(true);
        setUploadType('MEDIA');
        const uploadedUrls = [];
        let messageType = 'IMAGE';
        let failCount = 0;

        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          setUploadProgress(`${i + 1}/${result.assets.length}`);

          let fileName = asset.fileName || (asset.type === 'video' ? 'video.mp4' : 'image.jpg');
          if (fileName.toLowerCase().endsWith('.heic')) {
            fileName = fileName.replace(/\.heic$/i, '.jpg');
          }

          const file = {
            uri: asset.uri,
            type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
            name: fileName,
          };

          if (asset.type === 'video') messageType = 'VIDEO';

          // Retry logic: up to 3 attempts
          let success = false;
          let attempts = 0;
          const maxAttempts = 3;

          while (!success && attempts < maxAttempts) {
            attempts++;
            try {
              const response = await mediaApi.uploadFile(file);
              const url = response.data?.data?.url || response.data?.url || response.url;
              if (url) {
                uploadedUrls.push(url);
                success = true;
              } else {
                console.warn(`[MessageInput] Upload attempt ${attempts} returned no URL`);
              }
            } catch (uploadErr) {
              console.error(`[MessageInput] Upload attempt ${attempts} failed`, uploadErr);
              if (attempts === maxAttempts) {
                failCount++;
              } else {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            }
          }
        }

        if (uploadedUrls.length > 0) {
          onSendMessage('', replyingTo?.messageId, messageType, uploadedUrls);
          dispatch(clearReplyingTo());

          if (failCount > 0) {
            Alert.alert(t('notifications.title'), t('chat.image_send_status', { successCount: uploadedUrls.length, failCount }));
          }
        } else if (failCount > 0) {
          Alert.alert(t('common.error'), t('chat.image_upload_error'));
        }
      } else {
        console.log('[Gallery] Operation cancelled by user');
      }
    } catch (error) {
      console.error('[Gallery] pickMedia error:', error);
      Alert.alert(t('common.error'), t('chat.image_pick_error'));
    } finally {
      console.log('[Gallery] Resetting states in finally');
      setIsUploading(false);
      setUploadType(null);
      setUploadProgress(null);
      isPickingRef.current = false;
    }
  };

  const pickDocument = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    console.log('[File] Starting pickDocument process (Directly launching picker)');
    try {
      // Wait for modal to close fully
      await new Promise(resolve => setTimeout(resolve, 500));

      // DocumentPicker không cần quyền Storage trên iOS/Android hiện đại để mở trình chọn hệ thống
      console.log('[File] Launching document picker...');
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log(`[File] Selected ${result.assets.length} items`);
        setIsUploading(true);
        setUploadType('FILE');
        const uploadedUrls = [];
        let failCount = 0;

        const getMimeType = (fileName) => {
          if (!fileName) return 'application/octet-stream';
          const lower = fileName.toLowerCase();
          if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
          if (lower.endsWith('.png')) return 'image/png';
          if (lower.endsWith('.gif')) return 'image/gif';
          if (lower.endsWith('.webp')) return 'image/webp';
          if (lower.endsWith('.heic')) return 'image/heic';
          if (lower.endsWith('.mp4')) return 'video/mp4';
          if (lower.endsWith('.mov') || lower.endsWith('.qt')) return 'video/quicktime';
          if (lower.endsWith('.mkv')) return 'video/x-matroska';
          if (lower.endsWith('.mp3')) return 'audio/mpeg';
          if (lower.endsWith('.wav')) return 'audio/wav';
          if (lower.endsWith('.m4a')) return 'audio/m4a';
          if (lower.endsWith('.aac')) return 'audio/aac';
          if (lower.endsWith('.pdf')) return 'application/pdf';
          if (lower.endsWith('.txt')) return 'text/plain';
          if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'application/msword';
          if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'application/vnd.ms-excel';
          return 'application/octet-stream';
        };

        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          setUploadProgress(`${i + 1}/${result.assets.length}`);

          const file = {
            uri: asset.uri,
            type: asset.mimeType && asset.mimeType !== 'application/octet-stream' ? asset.mimeType : getMimeType(asset.name),
            name: asset.name,
          };

          // Retry logic
          let success = false;
          let attempts = 0;
          const maxAttempts = 3;

          while (!success && attempts < maxAttempts) {
            attempts++;
            try {
              const response = await mediaApi.uploadFile(file);
              const url = response.data?.data?.url || response.data?.url || response.url;
              if (url) {
                uploadedUrls.push(url);
                success = true;
              }
            } catch (uploadErr) {
              console.error(`[MessageInput] File upload attempt ${attempts} failed`, uploadErr);
              if (attempts === maxAttempts) {
                failCount++;
              } else {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            }
          }
        }

        if (uploadedUrls.length > 0) {
          onSendMessage('', replyingTo?.messageId, 'FILE', uploadedUrls);
          dispatch(clearReplyingTo());
          if (failCount > 0) {
            Alert.alert(t('notifications.title'), t('chat.file_send_status', { successCount: uploadedUrls.length, failCount }));
          }
        } else if (failCount > 0) {
          Alert.alert(t('common.error'), t('chat.file_upload_error'));
        }
      } else {
        console.log('[File] Operation cancelled by user');
      }
    } catch (error) {
      console.error('[File] pickDocument error:', error);
      Alert.alert(t('common.error'), t('chat.file_pick_error'));
    } finally {
      console.log('[File] Resetting states in finally');
      setIsUploading(false);
      setUploadType(null);
      setUploadProgress(null);
      isPickingRef.current = false;
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && !isLoading && !isUploading) {
      onSendMessage(message.trim(), replyingTo?.messageId);
      setMessage('');

      if (isTyping) {
        setIsTyping(false);
        onTypingChange && onTypingChange(false);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      dispatch(clearReplyingTo());
    }
  };

  const renderReplyContent = () => {
    if (!replyingTo) return null;

    const isImage = replyingTo.type === 'IMAGE' || (replyingTo.type !== 'VIDEO' && replyingTo.type !== 'FILE' && replyingTo.mediaUrls && replyingTo.mediaUrls.length > 0);
    const isVideo = replyingTo.type === 'VIDEO';
    const isFile = replyingTo.type === 'FILE';
    const isVoice = replyingTo.type === 'VOICE';

    const thumbUrl = (isImage || isVideo) && replyingTo.mediaUrls?.[0]
      ? (replyingTo.mediaUrls[0].startsWith('http') ? replyingTo.mediaUrls[0] : `${BASE_URL}${replyingTo.mediaUrls[0].startsWith('/') ? '' : '/'}${replyingTo.mediaUrls[0]}`)
      : null;

    const getFileConfig = (u) => {
      if (!u) return { color: '#6366f1', icon: 'file-document-outline' };
      const ext = u.split('.').pop().split('?')[0].toLowerCase();
      if (ext === 'pdf') return { color: '#ef4444', icon: 'file-pdf-box' };
      if (['doc', 'docx'].includes(ext)) return { color: '#3b82f6', icon: 'file-word-box' };
      if (['xls', 'xlsx'].includes(ext)) return { color: '#10b981', icon: 'file-excel-box' };
      if (['zip', 'rar', '7z'].includes(ext)) return { color: '#f59e0b', icon: 'zip-box' };
      return { color: '#6366f1', icon: 'file-document-outline' };
    };

    let displayText = replyingTo.content;
    const isVoiceMsg = isVoice || (displayText && (displayText.includes('chat-media/') || displayText.match(/\.(webm|m4a|mp3|wav|ogg|opus)(\?|$)/i)));

    if (isVoiceMsg) {
      displayText = t('chat.voice_message_title');
    } else if (!displayText) {
      if (isImage) displayText = t('chat.image_bracket');
      else if (isVideo) displayText = '[Video]';
      else if (isVoice) displayText = t('chat.voice_bracket');
      else if (isFile) {
        const fileName = replyingTo.mediaUrls?.[0]?.split('/').pop().split('?')[0].replace(/^[0-9a-f-]{36}_/, '');
        displayText = fileName ? decodeURIComponent(fileName) : t('chat.file_bracket');
      } else displayText = t('chat.message_bracket');
    }

    return (
      <View style={[styles.replyPreview, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.replyPreviewLine, { backgroundColor: colors.primary }]} />
        <View style={styles.replyPreviewContent}>
          <Text style={[styles.replyPreviewSender, { color: colors.foreground }]}>

            {t('chat.reply_to_prefix')} {String(replyingTo.senderId) === String(user?.userId) || String(replyingTo.senderId) === String(user?.id)
              ? t('chat.reply_to_self')
              : replyingTo.senderName}
          </Text>
          <Text style={[styles.replyPreviewText, { color: colors.textMuted }]} numberOfLines={1}>
            {displayText}
          </Text>

        </View>

        {isFile && replyingTo.mediaUrls?.[0] ? (
          <View style={[styles.replyThumbnail, { backgroundColor: getFileConfig(replyingTo.mediaUrls[0]).color, alignItems: 'center', justifyContent: 'center' }]}>
            <MaterialCommunityIcons name={getFileConfig(replyingTo.mediaUrls[0]).icon} size={20} color="#fff" />
          </View>
        ) : thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.replyThumbnail} resizeMode="cover" />
        ) : isVoice ? (
          <View style={[styles.replyThumbnail, { backgroundColor: colors.surface200, alignItems: 'center', justifyContent: 'center' }]}>
            <MaterialIcons name="mic" size={20} color={colors.primary} />
          </View>
        ) : null}


        <TouchableOpacity onPress={() => dispatch(clearReplyingTo())} style={styles.closeButton}>
          <MaterialIcons name="close" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
      {replyingTo && renderReplyContent()}
      <View style={styles.container}>
        {!isRecording ? (

          <>
            {!isExpanded && (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowAttachMenu(true)}
                  disabled={isLoading || isUploading}
                >
                  <MaterialIcons name="add-circle" size={26} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={takePhoto}
                  disabled={isLoading || isUploading}
                >
                  <MaterialIcons name="photo-camera" size={24} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={pickMedia}
                  disabled={isLoading || isUploading}
                >
                  <MaterialIcons name="image" size={24} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={startRecording}
                  disabled={isLoading || isUploading}
                >
                  <MaterialIcons name="mic" size={24} color={colors.primary} />
                </TouchableOpacity>

                {conversationType === 'GROUP' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={onOpenPoll}
                    disabled={isLoading || isUploading}
                  >
                    <MaterialCommunityIcons name="poll" size={24} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}

            {isExpanded && (
              <TouchableOpacity
                style={[styles.actionButton, { marginRight: 4 }]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsExpanded(false);
                }}
              >
                <MaterialIcons name="chevron-right" size={32} color={colors.primary} />
              </TouchableOpacity>
            )}


            <View style={{ flex: 1, position: 'relative' }}>
              {showMentions && (
                <View style={[styles.mentionList, { backgroundColor: colors.surface100, borderColor: colors.border, left: isExpanded ? -10 : -110 }]}>

                  <View style={[styles.mentionHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.mentionHeaderText, { color: colors.textMuted }]}>{t('chat.mention_members_header')}</Text>
                  </View>

                  <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="always">
                    {/* Option @All - Báo cho cả nhóm */}
                    {(mentionQuery === '' || 'tất cả'.includes(mentionQuery) || 'all'.includes(mentionQuery) || t('chat.mention_all').toLowerCase().includes(mentionQuery.toLowerCase())) && (
                      <TouchableOpacity
                        style={[styles.mentionItem, styles.mentionItemAll, { borderBottomColor: colors.border, backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)' }]}
                        onPress={() => handleSelectMention({ fullName: 'All' })}
                      >
                        <View style={styles.mentionAvatarWrapper}>
                          <View style={[styles.mentionAvatarAll, { backgroundColor: colors.primary }]}>
                            <MaterialIcons name="security" size={18} color="#fff" />
                          </View>
                        </View>
                        <View style={styles.mentionTextContent}>
                          <Text style={[styles.mentionName, { color: colors.foreground }]}>{t('chat.mention_all')}</Text>
                          <Text style={[styles.mentionSubName, { color: colors.primary }]}>@All</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {mentionResults.map((member) => (
                      <TouchableOpacity
                        key={member.userId || member.id}
                        style={[styles.mentionItem, { borderBottomColor: colors.border }]}
                        onPress={() => handleSelectMention(member)}
                      >
                        <View style={styles.mentionAvatarWrapper}>
                          <Image
                            source={{ uri: member.avatarUrl || member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName || 'U')}&background=random&color=fff&size=64` }}
                            style={styles.mentionAvatar}
                          />
                        </View>
                        <View style={styles.mentionTextContent}>
                          <Text style={[styles.mentionName, { color: colors.foreground }]}>{member.fullName}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.input,
                borderRadius: 22,
                paddingRight: 4
              }}>
                <TextInput
                  style={[styles.input, { backgroundColor: 'transparent', color: colors.foreground, flex: 1 }]}
                  value={message}
                  placeholder={t('chat.input_placeholder', { name: '' })}
                  placeholderTextColor={colors.textSubtle}
                  onChangeText={handleChange}
                  onSelectionChange={(event) => setCursorPosition(event.nativeEvent.selection.start)}
                  onFocus={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setIsExpanded(true);
                    setShowEmojis(false);
                  }}
                  editable={!isLoading && !isUploading}
                  multiline
                  maxHeight={100}
                >
                  {(() => {
                    if (!message) return null;

                    // Chỉ highlight nếu là GROUP chat
                    if (conversationType !== 'GROUP') return null;

                    // Tạo danh sách tên để regex
                    const memberNames = members
                      .map(m => (m.fullName || m.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                      .filter(Boolean);

                    const hasMention = memberNames.some(name => new RegExp(`@${name}`).test(message)) || message.includes('@All');
                    if (!hasMention) return null;

                    const allNames = [...memberNames, 'All'].join('|');
                    const regex = new RegExp(`(@(?:${allNames}))`, 'g');
                    const parts = message.split(regex);

                    return parts.map((part, i) => {
                      if (part.startsWith('@')) {
                        return (
                          <Text key={i} style={{ color: colors.primary, fontWeight: 'bold' }}>
                            {part}
                          </Text>
                        );
                      }
                      return <Text key={i}>{part}</Text>;
                    });
                  })()}
                </TextInput>

                <TouchableOpacity
                  style={{ padding: 6, justifyContent: 'center', alignItems: 'center' }}
                  onPress={handleToggleEmojis}
                >
                  <MaterialCommunityIcons
                    name={showEmojis ? "keyboard-outline" : "emoticon-happy"}
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>

            </View>

            {message.trim() ? (
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendMessage}
                disabled={isLoading || isUploading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <MaterialIcons name="send" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.sendButton}
                onPress={() => {
                  onSendMessage('👍', replyingTo?.messageId);
                  if (replyingTo) {
                    dispatch(clearReplyingTo());
                  }
                }}
                disabled={isLoading || isUploading}
              >
                <MaterialCommunityIcons name="thumb-up" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={[styles.recordingContainer, { backgroundColor: colors.input }]}>
            <View style={styles.recordingInfo}>
              <View style={styles.recordingDot} />
              <Text style={[styles.recordingTime, { color: colors.foreground }]}>{formatDuration(recordingDuration)}</Text>
            </View>
            <View style={styles.recordingActions}>
              <TouchableOpacity style={styles.cancelVoiceBtn} onPress={cancelRecording}>
                <Text style={styles.cancelVoiceText}>{t('chat.cancel_voice')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sendVoiceBtn, { backgroundColor: colors.primary }]} onPress={stopRecording}>
                <MaterialIcons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

        )}

        <PermissionModal
          visible={permissionModal.visible}
          type={permissionModal.type}
          onClose={permissionModal.onCancel || (() => setPermissionModal(prev => ({ ...prev, visible: false })))}
          onConfirm={permissionModal.onConfirm}
        />

        <Modal
          visible={showAttachMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAttachMenu(false)}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowAttachMenu(false)}
          >
            <View style={[styles.menuContainer, { backgroundColor: isDark ? colors.surface200 : '#fff' }]}>
              <Text style={[styles.menuTitle, { color: colors.foreground }]}>{t('chat.send_media_title')}</Text>
              <View style={styles.menuOptions}>
                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    setShowAttachMenu(false);
                    setTimeout(pickMedia, 100);
                  }}
                >
                  <View style={[styles.menuIconBg, { backgroundColor: isDark ? colors.surface300 : '#e0e7ff' }]}>
                    <MaterialIcons name="image" size={28} color="#4f46e5" />
                  </View>
                  <Text style={[styles.menuOptionText, { color: colors.foreground }]}>{t('chat.send_image')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    setShowAttachMenu(false);
                    setTimeout(pickDocument, 100);
                  }}
                >
                  <View style={[styles.menuIconBg, { backgroundColor: isDark ? colors.surface300 : '#fef3c7' }]}>
                    <MaterialIcons name="description" size={28} color="#d97706" />
                  </View>
                  <Text style={[styles.menuOptionText, { color: colors.foreground }]}>{t('chat.send_document')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
      {showEmojis && renderEmojiPanel()}
    </View>
  );
});


const styles = StyleSheet.create({
  root: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  replyPreviewLine: {
    width: 3,
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginRight: 12,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewSender: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 13,
  },
  replyThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  closeButton: {
    padding: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    minHeight: 48,
  },
  actionButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 36,
  },
  sendButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  recordingTime: {
    fontSize: 14,
    fontWeight: '600',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cancelVoiceBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelVoiceText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  sendVoiceBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 30,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  menuOption: {
    alignItems: 'center',
    gap: 8,
  },
  menuIconBg: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  mentionList: {
    position: 'absolute',
    bottom: '100%',
    left: -40,
    width: SCREEN_WIDTH - 24,
    maxHeight: 300,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  mentionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  mentionHeaderText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  mentionItemAll: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  mentionAvatarWrapper: {
    marginRight: 14,
  },
  mentionAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  mentionAvatarAll: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentionTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  mentionName: {
    fontSize: 15,
    fontWeight: '700',
  },
  mentionSubName: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  emojiPanelContainer: {
    borderTopWidth: 1,
  },
  expandHandleContainer: {
    height: 18,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  emojiTabHeader: {
    flexDirection: 'row',
    height: 48,
    borderBottomWidth: 1,
  },
  emojiTabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  emojiTabButtonActive: {
    borderBottomColor: '#6366f1',
  },
  emojiTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  emojiSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 19,
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  emojiSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  emojiPanelContent: {
    flex: 1,
    paddingTop: 8,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  emojiCell: {
    width: SCREEN_WIDTH / 8 - 2,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    columnGap: 10,
    rowGap: 10,
    paddingBottom: 16,
  },
  stickerCell: {
    width: (SCREEN_WIDTH - 24 - 30) / 4,
    height: (SCREEN_WIDTH - 24 - 30) / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerImage: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
  },
  gifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    columnGap: 10,
    rowGap: 10,
    paddingBottom: 16,
  },
  gifCell: {
    width: (SCREEN_WIDTH - 24 - 10) / 2,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  gifImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  panelLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categorySubBar: {
    height: 44,
    borderTopWidth: 1,
    justifyContent: 'center',
  },
  categorySubBarScroll: {
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  categorySubButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  categorySubButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  categorySubLabel: {
    fontSize: 16,
  },
});


export default MessageInput;
