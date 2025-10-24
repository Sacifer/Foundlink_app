import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../firebase/firebaseConfig';

interface ItemData {
  id?: string;
  userId?: string;
  user_id?: string;
  item_name?: string;
  itemName?: string;
  description?: string;
  image_url?: string;
  imageUrl?: string;
  created_at?: any;
  createdAt?: any;
}

interface MatchItem {
  id: string;
  type: 'match';
  createdAt: Date;
  confidence: number;
  accuracyLevel: string;
  status: any;
  lostItemId: string;
  foundItemId: string;
  lostItem: {
    userId?: string;
    item_name: string;
    description: string;
    image_url: string;
    created_at: Date;
  };
  foundItem: {
    userId?: string;
    item_name: string;
    description: string;
    image_url: string;
    created_at: Date;
  };
}

interface NotificationItem {
  id: string;
  type: 'notif';
  createdAt: Date;
  title?: string;
  body?: string;
  message?: string;
  read?: boolean;
}

type CombinedItem = MatchItem | NotificationItem;

interface ToastMessage {
  message: string;
  type: 'success' | 'danger';
}

function Notifications() {
  const auth = getAuth();

  const [aiMatches, setAiMatches] = useState<MatchItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [combined, setCombined] = useState<CombinedItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CombinedItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [userId, setUserId] = useState('');
  const [readAiMatches, setReadAiMatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const MATCHED_STATUS_ID = 'Status2';
  const VERIFIED_STATUS_ID = 'Status4';

  const showToast = (message: string, type: 'success' | 'danger' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Helper function to safely convert timestamps
  const convertTimestamp = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Date) return timestamp;
    if (timestamp?.toDate) return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp?.seconds) return new Date(timestamp.seconds * 1000);
    return new Date();
  };

  // Helper function to get status ID from reference
  const getStatusId = (statusRef: any): string | null => {
    if (!statusRef) return null;
    if (typeof statusRef === 'string') return statusRef;
    if (statusRef.id) return statusRef.id;
    if (statusRef.path) return statusRef.path.split('/').pop();
    return null;
  };

  // --- AUTH HANDLER ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId('');
        // User will be redirected by the app's auth flow
      }
    });
    return () => unsubscribeAuth();
  }, [auth]);

  // --- FETCH AI MATCHES ---
  useEffect(() => {
    if (!userId) return;

    const matchedStatusRef = doc(db, 'status', MATCHED_STATUS_ID);
    const verifiedStatusRef = doc(db, 'status', VERIFIED_STATUS_ID);

    const matchesQuery = query(
      collection(db, 'ai_matches'),
      where('status', 'in', [matchedStatusRef, verifiedStatusRef])
    );

    const unsubscribeMatches = onSnapshot(
      matchesQuery,
      async (snapshot) => {
        const userMatchesPromises = snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();

          // The ai_matches document already contains full item data in lostItem and foundItem maps
          const lostItemData: ItemData = data.lostItem || {};
          const foundItemData: ItemData = data.foundItem || {};

          // Debug logging
          console.log('Raw match data:', {
            id: docSnap.id,
            lostItemData,
            foundItemData
          });

          const match = {
            id: docSnap.id,
            type: 'match' as const,
            createdAt: convertTimestamp(data.createdAt),
            confidence: data.confidence || 0,
            accuracyLevel: data.accuracyLevel || 'Unknown',
            status: data.status,
            lostItemId: data.lostItemId,
            foundItemId: data.foundItemId,
            lostItem: {
              userId: lostItemData.userId || lostItemData.user_id,
              item_name: lostItemData.item_name || lostItemData.itemName || 'Unknown Item',
              description: lostItemData.description || 'No description',
              image_url: lostItemData.image_url || lostItemData.imageUrl || '',
              created_at: convertTimestamp(lostItemData.created_at || lostItemData.createdAt)
            },
            foundItem: {
              userId: foundItemData.userId || foundItemData.user_id,
              item_name: foundItemData.item_name || foundItemData.itemName || 'Unknown Item',
              description: foundItemData.description || 'No description',
              image_url: foundItemData.image_url || foundItemData.imageUrl || '',
              created_at: convertTimestamp(foundItemData.created_at || foundItemData.createdAt)
            }
          };

          console.log('Processed match:', match);
          return match;
        });

        const userMatches = (await Promise.all(userMatchesPromises))
          .filter((match) => {
            const hasLostUser = match.lostItem?.userId === userId;
            const hasFoundUser = match.foundItem?.userId === userId;
            return hasLostUser || hasFoundUser;
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        console.log('Fetched AI matches:', userMatches);
        setAiMatches(userMatches);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching AI matches:', error);
        showToast('Failed to load matches', 'danger');
        setLoading(false);
      }
    );

    return () => unsubscribeMatches();
  }, [userId]);

  // --- FETCH REGULAR NOTIFICATIONS ---
  useEffect(() => {
    if (!userId) return;

    const notifQuery = query(collection(db, 'notifications'), where('userId', '==', userId));

    const unsubscribeNotifs = onSnapshot(
      notifQuery,
      async (snapshot) => {
        const notifsPromises = snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          
          // If this is a match notification, fetch the actual item data
          if (data.type === 'match' && data.lostItemId && data.foundItemId) {
            try {
              const [lostItemDoc, foundItemDoc] = await Promise.all([
                getDoc(doc(db, 'items', data.lostItemId)),
                getDoc(doc(db, 'items', data.foundItemId))
              ]);

              const lostItemData = lostItemDoc.exists() ? lostItemDoc.data() : {};
              const foundItemData = foundItemDoc.exists() ? foundItemDoc.data() : {};

              return {
                id: docSnap.id,
                type: 'match' as const,
                createdAt: convertTimestamp(data.createdAt),
                confidence: data.confidence || 0,
                accuracyLevel: data.accuracyLevel || 'Unknown',
                status: data.status,
                lostItemId: data.lostItemId,
                foundItemId: data.foundItemId,
                lostItem: {
                  userId: lostItemData.userId || lostItemData.user_id,
                  item_name: lostItemData.item_name || lostItemData.itemName || 'Unknown Item',
                  description: lostItemData.description || 'No description',
                  image_url: lostItemData.image_url || lostItemData.imageUrl || '',
                  created_at: convertTimestamp(lostItemData.created_at || lostItemData.createdAt)
                },
                foundItem: {
                  userId: foundItemData.userId || foundItemData.user_id,
                  item_name: foundItemData.item_name || foundItemData.itemName || 'Unknown Item',
                  description: foundItemData.description || 'No description',
                  image_url: foundItemData.image_url || foundItemData.imageUrl || '',
                  created_at: convertTimestamp(foundItemData.created_at || foundItemData.createdAt)
                }
              } as MatchItem;
            } catch (err) {
              console.error('Error fetching match items:', err);
            }
          }

          // Regular notification
          return {
            id: docSnap.id,
            type: 'notif' as const,
            ...data,
            createdAt: convertTimestamp(data.createdAt)
          } as NotificationItem;
        });

        const notifs = (await Promise.all(notifsPromises))
          .filter(n => n !== undefined)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        console.log('Fetched regular notifications:', notifs);
        setNotifications(notifs as NotificationItem[]);
      },
      (error) => {
        console.error('Error fetching notifications:', error);
      }
    );

    return () => unsubscribeNotifs();
  }, [userId]);

  // --- COMBINE MATCHES + NOTIFS ---
  useEffect(() => {
    const combinedList = [...aiMatches, ...notifications].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    setCombined(combinedList);
  }, [aiMatches, notifications]);

  // --- MODAL HANDLERS ---
  const handleOpenModal = async (item: CombinedItem) => {
    setSelectedItem(item);
    setShowModal(true);

    if (item.type === 'notif' && !item.read) {
      try {
        await updateDoc(doc(db, 'notifications', item.id), { read: true });
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }

    if (item.type === 'match') setReadAiMatches((prev) => [...prev, item.id]);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setShowModal(false);
  };

  // --- VERIFY MATCH ---
  const handleVerify = async (match: MatchItem) => {
    if (!match) return;
    try {
      const verifiedStatusRef = doc(db, 'status', VERIFIED_STATUS_ID);

      if (match.lostItemId) {
        await updateDoc(doc(db, 'items', match.lostItemId), { status: verifiedStatusRef });
      }
      if (match.foundItemId) {
        await updateDoc(doc(db, 'items', match.foundItemId), { status: verifiedStatusRef });
      }

      await updateDoc(doc(db, 'ai_matches', match.id), { status: verifiedStatusRef });

      showToast('Match verified successfully!', 'success');
      setShowModal(false);
      setSelectedItem(null);
    } catch (err: any) {
      console.error('Error verifying match:', err);
      showToast('Failed to verify match: ' + err.message, 'danger');
    }
  };

  // --- DENY MATCH ---
  const handleDeny = async (match: MatchItem) => {
    if (!match) return;

    Alert.alert(
      'Deny Match',
      'Are you sure you want to deny this match? Items will be reverted to pending status.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            try {
              const pendingStatusRef = doc(db, 'status', 'Status1');
              if (match.lostItemId)
                await updateDoc(doc(db, 'items', match.lostItemId), { status: pendingStatusRef });
              if (match.foundItemId)
                await updateDoc(doc(db, 'items', match.foundItemId), { status: pendingStatusRef });
              await deleteDoc(doc(db, 'ai_matches', match.id));
              showToast('Match denied and items reverted to pending', 'success');
              setShowModal(false);
              setSelectedItem(null);
            } catch (err) {
              console.error(err);
              showToast('Failed to deny match', 'danger');
            }
          }
        }
      ]
    );
  };

  // --- RENDER NOTIFICATION ITEM ---
  const renderNotificationItem = (item: CombinedItem) => {
    if (item.type === 'match') {
      const isOwnerLost = item.lostItem?.userId === userId;
      const matchItem = isOwnerLost ? item.lostItem : item.foundItem;
      const isNew = !readAiMatches.includes(item.id);
      const statusId = getStatusId(item.status);
      const isVerified = statusId === VERIFIED_STATUS_ID;

      return (
        <TouchableOpacity
          key={item.id}
          style={[styles.notificationItem, isVerified && styles.verifiedItem]}
          onPress={() => handleOpenModal(item)}
        >
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationTitle, isVerified && styles.verifiedText]}>
              Your item "{matchItem?.item_name || 'Unknown'}" has been{' '}
              {isVerified ? 'verified' : 'matched'}!
            </Text>
            <Text style={styles.notificationSubtitle}>
              Confidence: {item.confidence}% ({item.accuracyLevel})
            </Text>
          </View>
          {isNew && !isVerified && (
            <View style={[styles.badge, styles.successBadge]}>
              <Text style={styles.badgeText}>New</Text>
            </View>
          )}
          {isVerified && (
            <View style={[styles.badge, styles.infoBadge]}>
              <Text style={styles.badgeText}>Verified</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    } else if (item.type === 'notif') {
      return (
        <TouchableOpacity
          key={item.id}
          style={styles.notificationItem}
          onPress={() => handleOpenModal(item)}
        >
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationTitle, !item.read && styles.unreadText]}>
              {item.title}
            </Text>
            <Text style={styles.notificationSubtitle}>{item.body || item.message}</Text>
          </View>
          {!item.read && (
            <View style={[styles.badge, styles.primaryBadge]}>
              <Text style={styles.badgeText}>New</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }
    return null;
  };

  // --- RENDER ---
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#14258b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, toast.type === 'success' ? styles.toastSuccess : styles.toastDanger]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#14258b" />
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {combined.filter((item) => item.type === 'match' || !item.read).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No notifications or matches yet.</Text>
            </View>
          ) : (
            combined
              .filter((item) => item.type === 'match' || (item.type === 'notif' && !item.read))
              .map((item) => renderNotificationItem(item))
          )}
        </ScrollView>
      )}

      {/* Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedItem?.type === 'match' ? 'Match Details' : selectedItem?.type === 'notif' ? selectedItem?.title : ''}
              </Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedItem?.type === 'match' ? (
                <>
                  <Text style={styles.modalDescription}>
                    Your item(s) has/have been matched. Please review the details below and verify
                    if this is a correct match.
                  </Text>

                  {/* Lost Item */}
                  <View style={styles.itemCard}>
                    <Text style={styles.itemCardTitle}>Lost Item</Text>
                    <Text style={styles.itemName}>
                      {selectedItem.lostItem?.item_name || 'N/A'}
                    </Text>
                    <Text style={styles.itemDescription}>
                      {selectedItem.lostItem?.description || 'No description'}
                    </Text>
                    {selectedItem.lostItem?.image_url ? (
                      <Image
                        source={{ uri: selectedItem.lostItem.image_url }}
                        style={styles.itemImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.noImageContainer}>
                        <Text style={styles.noImageText}>No image available</Text>
                      </View>
                    )}
                  </View>

                  {/* Found Item */}
                  <View style={styles.itemCard}>
                    <Text style={[styles.itemCardTitle, { color: '#5cb85c' }]}>Found Item</Text>
                    <Text style={styles.itemName}>
                      {selectedItem.foundItem?.item_name || 'N/A'}
                    </Text>
                    <Text style={styles.itemDescription}>
                      {selectedItem.foundItem?.description || 'No description'}
                    </Text>
                    {selectedItem.foundItem?.image_url ? (
                      <Image
                        source={{ uri: selectedItem.foundItem.image_url }}
                        style={styles.itemImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.noImageContainer}>
                        <Text style={styles.noImageText}>No image available</Text>
                      </View>
                    )}
                  </View>

                  {/* Confidence */}
                  <View style={styles.confidenceContainer}>
                    <Text style={styles.confidenceText}>
                      Match Confidence: {selectedItem.confidence}%
                    </Text>
                  </View>
                </>
              ) : selectedItem?.type === 'notif' ? (
                <Text style={styles.modalBodyText}>
                  {selectedItem?.body || selectedItem?.message}
                </Text>
              ) : null}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              {selectedItem?.type === 'match' ? (
                <>
                  {getStatusId(selectedItem.status) === VERIFIED_STATUS_ID ? (
                    <TouchableOpacity
                      style={[styles.modalButton, styles.secondaryButton]}
                      onPress={handleCloseModal}
                    >
                      <Text style={styles.secondaryButtonText}>Close</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.denyButton]}
                        onPress={() => handleDeny(selectedItem)}
                      >
                        <Text style={styles.buttonText}>Deny Match</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.verifyButton]}
                        onPress={() => handleVerify(selectedItem)}
                      >
                        <Text style={styles.buttonText}>Verify Match</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.modalButton, styles.secondaryButton]}
                  onPress={handleCloseModal}
                >
                  <Text style={styles.secondaryButtonText}>Close</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff8e1'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff8e1',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  backButton: {
    marginRight: 16
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#14258b'
  },
  scrollView: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  emptyText: {
    fontSize: 16,
    color: '#999'
  },
  notificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  verifiedItem: {
    opacity: 0.6
  },
  notificationContent: {
    flex: 1,
    marginRight: 8
  },
  notificationTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4
  },
  unreadText: {
    fontWeight: 'bold'
  },
  verifiedText: {
    fontWeight: 'normal'
  },
  notificationSubtitle: {
    fontSize: 14,
    color: '#666'
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  successBadge: {
    backgroundColor: '#5cb85c'
  },
  infoBadge: {
    backgroundColor: '#5cb85c'
  },
  primaryBadge: {
    backgroundColor: '#5cb85c'
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  toast: {
    position: 'absolute',
    top: 60,
    right: 16,
    left: 16,
    padding: 16,
    borderRadius: 8,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  toastSuccess: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1
  },
  toastDanger: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1
  },
  toastText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  modalBody: {
    padding: 16
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16
  },
  itemCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ccc'
  },
  itemCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5cb85c',
    marginBottom: 8
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12
  },
  itemImage: {
    width: '100%',
    height: 200,
    borderRadius: 8
  },
  noImageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  noImageText: {
    fontSize: 14,
    color: '#999'
  },
  confidenceContainer: {
    backgroundColor: '#d1ecf1',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bee5eb'
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0c5460'
  },
  modalBodyText: {
    fontSize: 14,
    color: '#333'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0'
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center'
  },
  denyButton: {
    backgroundColor: '#d9534f'
  },
  verifyButton: {
    backgroundColor: '#5cb85c'
  },
  secondaryButton: {
    backgroundColor: '#6c757d'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default Notifications;