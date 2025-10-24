import { getAuth } from 'firebase/auth';
import {
  collection,
  DocumentReference,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  Timestamp,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../firebase/firebaseConfig';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const ITEMS_PER_PAGE = 20;

interface ItemData {
  id: string;
  item_name?: string;
  type?: string;
  image_url?: string;
  description?: string;
  location?: string;
  date_lost_found?: Timestamp | string;
  status?: DocumentReference;
  statusValue?: string;
  category?: DocumentReference;
  categoryValue?: string;
}

function BrowseScreen() {
  const [items, setItems] = useState<ItemData[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'lost' | 'found'>('all');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const auth = getAuth();

  // Fetch items with pagination
  useEffect(() => {
    setLoading(true);
    setItems([]);
    setLastDoc(null);
    setHasMore(true);
    
    fetchItems(true);
  }, [tab]);

  const fetchItems = async (isInitial: boolean = false) => {
    if (!isInitial && (!hasMore || loadingMore)) return;
    
    if (!isInitial) setLoadingMore(true);
    
    try {
      // Build base query - only order by date, no where clause
      let q = query(
        collection(db, 'items'),
        orderBy('date_lost_found', 'desc'),
        limit(ITEMS_PER_PAGE * 2) // Fetch more to compensate for filtering
      );

      // Add pagination
      if (!isInitial && lastDoc) {
        q = query(
          collection(db, 'items'),
          orderBy('date_lost_found', 'desc'),
          startAfter(lastDoc),
          limit(ITEMS_PER_PAGE * 2)
        );
      }

      const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        if (querySnapshot.empty) {
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        const itemsPromises: Promise<ItemData>[] = [];
        
        querySnapshot.forEach((docSnap) => {
          const itemData: ItemData = { id: docSnap.id, ...docSnap.data() };
          
          // Filter by type in-memory
          const typeValue = tab === 'lost' ? 'Lost' : tab === 'found' ? 'Found' : null;
          if (typeValue && itemData.type !== typeValue) {
            return; // Skip this item
          }
          
          const promises: Promise<void>[] = [];
          
          // Fetch status
          if (itemData.status && itemData.status.path) {
            promises.push(
              getDoc(itemData.status).then(statusDoc => {
                itemData.statusValue = statusDoc.exists() ? statusDoc.data()?.status_name : 'Pending';
              })
            );
          }
          
          // Fetch category
          if (itemData.category && itemData.category.path) {
            promises.push(
              getDoc(itemData.category).then(catDoc => {
                itemData.categoryValue = catDoc.exists() ? catDoc.data()?.cat_name : '';
              })
            );
          }
          
          itemsPromises.push(
            Promise.all(promises).then(() => itemData)
          );
        });
        
        const newItems = await Promise.all(itemsPromises);
        
        if (isInitial) {
          setItems(newItems);
        } else {
          setItems(prev => [...prev, ...newItems]);
        }
        
        // Update last document for pagination
        const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastDoc(lastVisible);
        
        // Check if there are more items
        setHasMore(querySnapshot.docs.length === ITEMS_PER_PAGE * 2);
        
        setLoading(false);
        setLoadingMore(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching items:', error);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const tabs = {
    all: 'All Items',
    lost: 'Lost',
    found: 'Found',
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.item_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setTimeout(() => setAlertMessage(''), 4000);
  };

  const getCardColors = (type?: string) => {
    const isLost = type?.toLowerCase() === 'lost';
    const isFound = type?.toLowerCase() === 'found';
    
    return {
      bg: isLost ? '#ffe8f0' : isFound ? '#d4f4e8' : '#f5f5f5',
      border: isLost ? '#ffcce0' : isFound ? '#a8e8d0' : '#e0e0e0',
      badge: isLost ? '#ff4d6d' : isFound ? '#52c990' : '#9e9e9e',
    };
  };

  const renderItem = ({ item }: { item: ItemData }) => {
    const colors = getCardColors(item.type);
    
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}
        onPress={() => setSelectedItem(item)}
        activeOpacity={0.7}
      >
        <Image
          source={item.image_url && item.image_url.trim() !== '' 
            ? { uri: item.image_url } 
            : require('../../assets/noimage.png')}
          style={styles.cardImage}
          resizeMode="cover"
        />
        <View style={styles.cardBody}>
          <View style={[styles.badge, { backgroundColor: colors.badge }]}>
            <Text style={styles.badgeText}>{item.type || 'Unknown'}</Text>
          </View>
          <Text style={styles.itemName} numberOfLines={2}>{item.item_name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {alertMessage ? (
        <View style={styles.alert}>
          <Text style={styles.alertText}>{alertMessage}</Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <Text style={styles.title}>Browse Items</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabContainer}
        contentContainerStyle={styles.tabContent}
      >
        {(Object.entries(tabs) as [keyof typeof tabs, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.tabButton,
              tab === key && styles.tabButtonActive,
            ]}
            onPress={() => setTab(key)}
          >
            <Text
              style={[
                styles.tabText,
                tab === key && styles.tabTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          onEndReached={() => fetchItems(false)}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No items found.</Text>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#FFD700" />
              </View>
            ) : null
          }
        />
      )}

      {selectedItem && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedItem(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[
              styles.modalContent,
              { backgroundColor: getCardColors(selectedItem.type).bg }
            ]}>
              <View style={[
                styles.modalHeader,
                { borderBottomColor: getCardColors(selectedItem.type).badge }
              ]}>
                <View style={styles.modalTitleRow}>
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {selectedItem.item_name}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: getCardColors(selectedItem.type).badge }]}>
                    <Text style={styles.badgeText}>{selectedItem.type || 'Unknown'}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedItem(null)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Image
                  source={selectedItem.image_url 
                    ? { uri: selectedItem.image_url } 
                    : require('../../assets/noimage.png')}
                  style={[
                    styles.modalImage,
                    { borderColor: getCardColors(selectedItem.type).border }
                  ]}
                  resizeMode="cover"
                />

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>STATUS</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.detailValue}>
                      {selectedItem.statusValue || 'Pending'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>CATEGORY</Text>
                  <Text style={styles.detailValue}>
                    {selectedItem.categoryValue || 'N/A'}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>DESCRIPTION</Text>
                  <Text style={styles.detailValueText}>
                    {selectedItem.description || 'N/A'}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>
                    DATE {selectedItem.type === 'Found' ? 'FOUND' : 'LOST'}
                  </Text>
                  <Text style={styles.detailValue}>
                    {selectedItem.date_lost_found && typeof selectedItem.date_lost_found === 'object' && 'toDate' in selectedItem.date_lost_found
                      ? selectedItem.date_lost_found.toDate().toLocaleDateString() 
                      : selectedItem.date_lost_found || 'N/A'}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>LOCATION</Text>
                  <Text style={styles.detailValue}>
                    {selectedItem.location || 'N/A'}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffbf0',
  },
  alert: {
    backgroundColor: '#d4edda',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  alertText: {
    color: '#155724',
    fontSize: 14,
  },
  header: {
    padding: 16,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a237e',
    fontStyle: 'italic',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  tabContainer: {
    marginBottom: 16,
  },
  tabContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginRight: 8,
  },
  tabButtonActive: {
    backgroundColor: '#3949ab',
    borderColor: '#3949ab',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardImage: {
    width: '100%',
    height: 140,
  },
  cardBody: {
    padding: 12,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
  },
  modalImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    borderWidth: 3,
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  detailValueText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
});

export default BrowseScreen;