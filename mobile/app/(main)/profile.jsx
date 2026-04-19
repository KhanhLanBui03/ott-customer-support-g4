import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../../src/store/authSlice';

/**
 * ProfileScreen
 * User profile display and settings
 */
const ProfileScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  
  // Get user from Redux
  const user = useSelector((state) => state.auth.user);
  const isLoading = useSelector((state) => state.auth.isLoading);

  // Mock user data if Redux not connected
  const displayUser = user || {
    userId: 'user-123',
    phoneNumber: '+1234567890',
    name: 'John Doe',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
    bio: 'Software Developer',
    status: 'online',
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        onPress: () => {
          dispatch(logoutUser());
        },
        style: 'destructive',
      },
    ]);
  };

  const handleEditProfile = () => {
    // TODO: Navigate to edit profile screen
    Alert.alert('Edit Profile', 'Edit profile screen coming soon!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <Image
            source={{ uri: displayUser.avatar }}
            style={styles.avatar}
          />

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayUser.name || 'Unknown'}</Text>
            <Text style={styles.phoneNumber}>{displayUser.phoneNumber}</Text>
            <Text style={styles.bio}>{displayUser.bio || 'No bio'}</Text>

            {/* Status Badge */}
            <View style={styles.statusBadge}>
              <View
                style={[
                  styles.statusDot,
                  displayUser.status === 'online' && styles.statusOnline,
                ]}
              />
              <Text style={styles.statusText}>
                {displayUser.status === 'online' ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>

          {/* Edit Button */}
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <MaterialIcons name="edit" size={24} color="#667eea" />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menu}>
          {/* Account Settings */}
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <MaterialIcons name="security" size={24} color="#667eea" />
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>Security</Text>
                <Text style={styles.menuItemSubtitle}>Change password, 2FA</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#d1d5db" />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <MaterialIcons name="notifications" size={24} color="#667eea" />
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>Notifications</Text>
                <Text style={styles.menuItemSubtitle}>Sound, messages, calls</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#d1d5db" />
          </TouchableOpacity>

          {/* Privacy */}
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <MaterialIcons name="privacy-tip" size={24} color="#667eea" />
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>Privacy</Text>
                <Text style={styles.menuItemSubtitle}>Last seen, profile visibility</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#d1d5db" />
          </TouchableOpacity>

          {/* Storage */}
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <MaterialIcons name="storage" size={24} color="#667eea" />
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>Storage</Text>
                <Text style={styles.menuItemSubtitle}>Manage media and files</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#d1d5db" />
          </TouchableOpacity>

          {/* Help */}
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <MaterialIcons name="help" size={24} color="#667eea" />
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>Help & Support</Text>
                <Text style={styles.menuItemSubtitle}>FAQ, contact us</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={isLoading}
        >
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  header: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 24,
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },

  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },

  userInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },

  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },

  phoneNumber: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },

  bio: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },

  statusOnline: {
    backgroundColor: '#10b981',
  },

  statusText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },

  editButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 8,
  },

  menu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },

  menuItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  menuItemText: {
    flex: 1,
  },

  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },

  menuItemSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },

  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ProfileScreen;
