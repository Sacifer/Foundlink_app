import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../firebase/firebaseConfig';

const { width } = Dimensions.get('window');

interface ItemData {
  id: string;
  item_name: string;
  description: string;
  location: string;
  image_url: string;
  type: string;
  date_lost_found?: Timestamp | string | Date;
  userId: string;
  status?: DocumentReference;
  statusValue?: string;
  category?: DocumentReference;
  categoryValue?: string;
}

interface EditValues {
  item_name: string;
  description: string;
  location: string;
  image_url: string;
  categoryValue: string;
}

interface AlertInfo {
  show: boolean;
  message: string;
  type: string;
}

function HomeScreen() {
  const [username, setUsername] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tab, setTab] = useState<string>('yourReports');
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValues, setEditValues] = useState<EditValues>({
    item_name: '',
    description: '',
    location: '',
    image_url: '',
    categoryValue: '',
  });
  const [userReports, setUserReports] = useState<ItemData[]>([]);
  const [alertInfo, setAlertInfo] = useState<AlertInfo>({ show: false, message: '', type: '' });
  const [notifications, setNotifications] = useState<number>(0);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const auth = getAuth();
  const storage = getStorage();

  const noImage = require('../../assets/noimage.png');

  const capitalize = (str: string): string => (str ? str.charAt(0).toUpperCase() + str.slice(1) : '');

  // Fetch user data
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          setUserId(user.uid);
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUsername(userData.username?.trim() || 'Student');
          } else {
            setUsername('Student');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUsername('Student');
        }
      } else {
        setUserId('');
        setUsername('');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Fetch user's items
  useEffect(() => {
    if (!auth.currentUser || !userId) return;

    const q = query(collection(db, 'items'), where('userId', '==', userId));

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        const itemsPromises: Promise<ItemData>[] = [];
        querySnapshot.forEach((docSnap) => {
          const itemData = { id: docSnap.id, ...docSnap.data() } as ItemData;
          const promises: Promise<void>[] = [];

          if (itemData.status && itemData.status.path) {
            promises.push(
              getDoc(itemData.status).then((statusDoc) => {
                itemData.statusValue = statusDoc.exists()
                  ? statusDoc.data().status_name
                  : 'Pending';
              })
            );
          }

          if (itemData.category && itemData.category.path) {
            promises.push(
              getDoc(itemData.category).then((catDoc) => {
                itemData.categoryValue = catDoc.exists()
                  ? catDoc.data().cat_name
                  : '';
              })
            );
          }

          itemsPromises.push(Promise.all(promises).then(() => itemData));
        });

        const items = await Promise.all(itemsPromises);
        setUserReports(items);
      },
      (error) => {
        console.error('Error fetching items:', error);
      }
    );

    return () => unsubscribe();
  }, [auth.currentUser, userId]);

  // Fetch unread notifications
  useEffect(() => {
    if (!auth.currentUser || !userId) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const unreadCount = querySnapshot.docs.filter(
        (doc) => doc.data().type !== 'match'
      ).length;
      setNotifications(unreadCount);
    });

    return () => unsubscribe();
  }, [auth.currentUser, userId]);

  const tabs: Record<string, string> = {
    yourReports: 'Your Reports',
    pending: 'Pending',
    claimed: 'Claimed',
    matched: 'Matched',
  };

  const filteredItems = userReports.filter((item) => {
    const matchesTab =
      tab === 'yourReports'
        ? true
        : (item.statusValue || 'Pending') === capitalize(tab);
    const matchesSearch = item.item_name
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const showAlert = (message: string, type: string) => {
    Alert.alert(type === 'success' ? 'Success' : 'Error', message);
  };

  const handleEdit = () => {
    if (!selectedItem) return;
    setIsEditing(true);

    setEditValues({
      item_name: selectedItem.item_name || '',
      description: selectedItem.description || '',
      location: selectedItem.location || '',
      image_url: selectedItem.image_url || '',
      categoryValue: selectedItem.categoryValue || '',
    });
  };

  const handleImageUpload = async () => {
    if (!selectedItem) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      try {
        setLoading(true);
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const fileRef = ref(
          storage,
          `item_images/${selectedItem.id}_${Date.now()}.jpg`
        );
        await uploadBytes(fileRef, blob);
        const url = await getDownloadURL(fileRef);
        setEditValues((prev) => ({ ...prev, image_url: url }));
        showAlert('Image uploaded successfully.', 'success');
      } catch (error) {
        console.error('Error uploading image:', error);
        showAlert('Failed to upload image.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const saveEdit = async () => {
    if (!selectedItem) return;

    try {
      setLoading(true);
      const updateData: Partial<ItemData> = {
        item_name: editValues.item_name,
        description: editValues.description,
        location: editValues.location,
        image_url: editValues.image_url,
      };

      if (editValues.categoryValue !== selectedItem.categoryValue) {
        const categoryMap: Record<string, DocumentReference> = {
          Electronics: doc(db, 'categories', 'Cat1'),
          'Personal Items': doc(db, 'categories', 'Cat2'),
          Accessories: doc(db, 'categories', 'Cat3'),
          Documents: doc(db, 'categories', 'Cat4'),
          Others: doc(db, 'categories', 'Cat5'),
        };
        if (categoryMap[editValues.categoryValue]) {
          updateData.category = categoryMap[editValues.categoryValue];
        }
      }

      await updateDoc(doc(db, 'items', selectedItem.id), updateData);

      const updatedItem: ItemData = {
        ...selectedItem,
        ...editValues,
      };
      setSelectedItem(updatedItem);
      setUserReports((prev) =>
        prev.map((item) => (item.id === selectedItem.id ? updatedItem : item))
      );

      showAlert('Report updated successfully.', 'success');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating item:', error);
      showAlert('Failed to update report.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'items', selectedItem.id));
      showAlert('Report deleted successfully.', 'success');
      setSelectedItem(null);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting item:', error);
      showAlert('Failed to delete report.', 'error');
      setShowDeleteModal(false);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ItemData }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        setSelectedItem(item);
        setIsEditing(false);
      }}
    >
      <Image
        source={
          item.image_url && item.image_url.trim() !== ''
            ? { uri: item.image_url }
            : noImage
        }
        style={styles.cardImage}
      />
      <View style={styles.cardBody}>
        <Text style={styles.cardText} numberOfLines={1}>
          {item.item_name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hello, {username}!</Text>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/notification')}
        >
          <Text style={styles.bellIcon}>🔔</Text>
          {notifications > 0 && <View style={styles.notificationDot} />}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {Object.entries(tabs).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No items found.</Text>
        }
      />

      {/* Item Detail Modal */}
      <Modal
        visible={selectedItem !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedItem?.item_name}</Text>
                <TouchableOpacity onPress={() => setSelectedItem(null)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <Image
                source={
                  isEditing
                    ? editValues.image_url
                      ? { uri: editValues.image_url }
                      : noImage
                    : selectedItem?.image_url
                    ? { uri: selectedItem.image_url }
                    : noImage
                }
                style={styles.modalImage}
              />

              {isEditing && selectedItem?.statusValue !== 'Claimed' && (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleImageUpload}
                >
                  <Text style={styles.uploadButtonText}>Choose Image</Text>
                </TouchableOpacity>
              )}

              {isEditing && selectedItem?.statusValue !== 'Claimed' ? (
                <View style={styles.formContainer}>
                  <Text style={styles.label}>Item Name</Text>
                  <View style={styles.pickerContainer}>
                    {['ID Card', 'Ballpen', 'Wallet', 'Tumbler', 'Phone', 'Key Chain', 'Others'].map(
                      (itemName) => (
                        <TouchableOpacity
                          key={itemName}
                          style={[
                            styles.categoryOption,
                            editValues.item_name === itemName && styles.categoryOptionActive,
                          ]}
                          onPress={() =>
                            setEditValues({ ...editValues, item_name: itemName })
                          }
                        >
                          <Text
                            style={[
                              styles.categoryOptionText,
                              editValues.item_name === itemName && styles.categoryOptionTextActive,
                            ]}
                          >
                            {itemName}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>

                  <Text style={styles.label}>Category</Text>
                  <View style={styles.pickerContainer}>
                    {['Electronics', 'Personal Items', 'Accessories', 'Documents', 'Others'].map(
                      (cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryOption,
                            editValues.categoryValue === cat && styles.categoryOptionActive,
                          ]}
                          onPress={() =>
                            setEditValues({ ...editValues, categoryValue: cat })
                          }
                        >
                          <Text
                            style={[
                              styles.categoryOptionText,
                              editValues.categoryValue === cat && styles.categoryOptionTextActive,
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>

                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={editValues.description}
                    onChangeText={(text) =>
                      setEditValues({ ...editValues, description: text })
                    }
                    multiline
                    numberOfLines={4}
                  />

                  <Text style={styles.label}>Location</Text>
                  <TextInput
                    style={styles.input}
                    value={editValues.location}
                    onChangeText={(text) =>
                      setEditValues({ ...editValues, location: text })
                    }
                  />
                </View>
              ) : (
                <View style={styles.detailsContainer}>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Type:</Text>{' '}
                    {selectedItem?.type || 'N/A'}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Status:</Text>{' '}
                    {selectedItem?.statusValue || 'Pending'}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Category:</Text>{' '}
                    {selectedItem?.categoryValue || 'N/A'}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Description:</Text>{' '}
                    {selectedItem?.description || 'N/A'}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>
                      Date {selectedItem?.type === 'Found' ? 'Found' : 'Lost'}:
                    </Text>
                    {' '}
                    {selectedItem?.date_lost_found && typeof selectedItem.date_lost_found === 'object' && 'toDate' in selectedItem.date_lost_found
                      ? (selectedItem.date_lost_found as Timestamp).toDate().toLocaleDateString()
                      : selectedItem?.date_lost_found?.toString() || 'N/A'}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Location:</Text>{' '}
                    {selectedItem?.location || 'N/A'}
                  </Text>
                </View>
              )}

              <View style={styles.modalFooter}>
                {selectedItem?.statusValue === 'Claimed' ? (
                  <TouchableOpacity
                    style={[styles.button, styles.buttonDanger]}
                    onPress={() => setShowDeleteModal(true)}
                  >
                    <Text style={styles.buttonText}>Delete</Text>
                  </TouchableOpacity>
                ) : isEditing ? (
                  <TouchableOpacity
                    style={[styles.button, styles.buttonPrimary]}
                    onPress={saveEdit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonPrimary]}
                      onPress={handleEdit}
                    >
                      <Text style={styles.buttonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonDanger]}
                      onPress={() => setShowDeleteModal(true)}
                    >
                      <Text style={styles.buttonText}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>Confirm Deletion</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this item report?
            </Text>
            <Text style={styles.deleteModalSubtext}>
              This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.buttonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={handleDelete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Delete</Text>
                )}
              </TouchableOpacity>
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
    backgroundColor: '#fff8e1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#14258b',
    fontStyle: 'italic',
  },
  notificationButton: {
    position: 'relative',
    padding: 10,
  },
  bellIcon: {
    fontSize: 24,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    backgroundColor: '#14258b',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#dee2e6',
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
  },
  tabsContainer: {
    maxHeight: 50,
    marginBottom: 10,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: '#14258b',
    borderColor: '#ffd700',
  },
  tabText: {
    color: '#495057',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  card: {
    width: (width - 30) / 2,
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginHorizontal: 5,
  },
  cardImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  cardBody: {
    padding: 10,
    alignItems: 'center',
  },
  cardText: {
    fontWeight: '500',
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: width * 0.9,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
    paddingLeft: 10,
  },
  modalImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  uploadButton: {
    backgroundColor: '#14258b',
    padding: 12,
    margin: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    marginBottom: 15,
  },
  categoryOption: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  categoryOptionActive: {
    backgroundColor: '#14258b',
    borderColor: '#ffd700',
  },
  categoryOptionText: {
    color: '#333',
  },
  categoryOptionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  detailsContainer: {
    padding: 20,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 10,
    color: '#333',
  },
  detailLabel: {
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#007bff',
  },
  buttonDanger: {
    backgroundColor: '#dc3545',
  },
  buttonSecondary: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonTextSecondary: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteModal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: width * 0.8,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  deleteModalText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  deleteModalSubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});

export default HomeScreen;