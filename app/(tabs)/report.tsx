import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { auth, db, storage } from '../../firebase/firebaseConfig';

interface ReportProps {
  navigation?: any;
}

type ItemType = 'lost' | 'found';
type CategoryType = 'Cat1' | 'Cat2' | 'Cat3' | 'Cat4';

function Report({ navigation }: ReportProps) {
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [submittedType, setSubmittedType] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [itemType, setItemType] = useState<ItemType>('lost');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryType>('Cat1');
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [itemName, setItemName] = useState<string>('ID Card');
  const [customItemName, setCustomItemName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Auto-hide success message after 3 seconds
  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => setShowSuccessModal(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

  // Request image picker permissions on mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to upload images!');
        }
      }
    })();
  }, []);

  const pickImage = async (): Promise<void> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSubmit = async (): Promise<void> => {
    console.log('🚀 Starting submission...');

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to submit a report.');
      return;
    }

    // Validation
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    if (itemName === 'Others' && !customItemName.trim()) {
      Alert.alert('Error', 'Please specify the item name');
      return;
    }

    setLoading(true);
    setUploadProgress('Preparing data...');

    try {
      const rawItemName = itemName === 'Others' ? customItemName.trim() : itemName;
      let imageUrl = '';

      // Upload image if exists
      if (imageUri) {
        try {
          setUploadProgress('Uploading image...');
          console.log('📤 Starting image upload...');

          // Fetch the image as blob for web SDK
          const response = await fetch(imageUri);
          const blob = await response.blob();

          const timestamp = Date.now();
          const fileName = `${currentUser.uid}_${timestamp}.jpg`;
          const storageRef = ref(storage, `reports/${fileName}`);

          const uploadTask = uploadBytesResumable(storageRef, blob);

          await new Promise<void>((resolve, reject) => {
            uploadTask.on(
              'state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(`Uploading image... ${progress.toFixed(0)}%`);
              },
              (error) => {
                console.error('❌ Upload failed:', error);
                reject(error);
              },
              async () => {
                console.log('✅ Upload complete!');
                imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve();
              }
            );
          });
        } catch (uploadError) {
          console.error('❌ Image upload error:', uploadError);
          Alert.alert(
            'Upload Failed',
            'Failed to upload image. Continuing without image...'
          );
          imageUrl = '';
        }
      }

      // Save to Firestore
      setUploadProgress('Saving to database...');
      
      const reportData = {
        userId: currentUser.uid,
        type: itemType === 'lost' ? 'Lost' : 'Found',
        item_name: rawItemName,
        description: description.trim(),
        date_lost_found: Timestamp.fromDate(date),
        location: location.trim() || '',
        tags: [],
        image_url: imageUrl,
        category: doc(db, 'categories', category),
        status: doc(db, 'status', 'Status1'),
        created_at: serverTimestamp(),
      };

      console.log('💾 Saving to Firestore...');
      const docRef = await addDoc(collection(db, 'items'), reportData);
      console.log('✅ Document saved with ID:', docRef.id);

      setSubmittedType(itemType);
      
      // Reset form
      setImageUri(null);
      setItemType('lost');
      setCategory('Cat1');
      setItemName('ID Card');
      setCustomItemName('');
      setDescription('');
      setLocation('');
      setDate(new Date());
      setUploadProgress('');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('❌ Submission error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', 'Failed to submit report: ' + errorMessage);
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date): void => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.card}>
          <Text style={styles.title}>Report Item</Text>

          {/* Upload Progress */}
          {uploadProgress ? (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>{uploadProgress}</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: uploadProgress.match(/\d+/)
                        ? `${uploadProgress.match(/\d+/)?.[0]}%` as any
                        : '0%',
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {/* Item Name */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Item Name:<Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={itemName}
                onValueChange={(value) => {
                  setItemName(value);
                  if (value !== 'Others') {
                    setCustomItemName('');
                  }
                }}
                style={styles.picker}
              >
                <Picker.Item label="Select Item Name" value="ID Card" />
                <Picker.Item label="ID Card" value="ID Card" />
                <Picker.Item label="Ballpen" value="Ballpen" />
                <Picker.Item label="Wallet" value="Wallet" />
                <Picker.Item label="Tumbler" value="Tumbler" />
                <Picker.Item label="Phone" value="Phone" />
                <Picker.Item label="Key Chain" value="Key Chain" />
                <Picker.Item label="Others" value="Others" />
              </Picker>
            </View>
            {itemName === 'Others' && (
              <TextInput
                style={[styles.input, styles.mt10]}
                placeholder="Please specify item name"
                value={customItemName}
                onChangeText={setCustomItemName}
              />
            )}
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Description:<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Category */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Category:<Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={category}
                onValueChange={(value) => setCategory(value as CategoryType)}
                style={styles.picker}
              >
                <Picker.Item label="Electronics" value="Cat1" />
                <Picker.Item label="Personal Items" value="Cat2" />
                <Picker.Item label="Documents" value="Cat3" />
                <Picker.Item label="Others" value="Cat4" />
              </Picker>
            </View>
          </View>

          {/* Item Type */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Item Type:<Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={itemType}
                onValueChange={(value) => setItemType(value as ItemType)}
                style={styles.picker}
              >
                <Picker.Item label="Lost" value="lost" />
                <Picker.Item label="Found" value="found" />
              </Picker>
            </View>
          </View>

          {/* Date */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {itemType === 'found' ? 'Date Found:' : 'Date Lost:'}
              <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Location */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location:</Text>
            <TextInput
              style={styles.input}
              placeholder={
                itemType === 'found' ? 'Where you found it' : 'Where you lost it'
              }
              value={location}
              onChangeText={setLocation}
            />
          </View>

          {/* Image */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Image:</Text>
            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <Text style={styles.imageButtonText}>
                {imageUri ? 'Change Image' : 'Choose Image'}
              </Text>
            </TouchableOpacity>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            )}
            <Text style={styles.helperText}>
              Only JPEG and PNG files. Max size: 5MB (Optional)
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Success Modal */}
      {showSuccessModal && (
        <View style={styles.successModal}>
          <View style={styles.successContent}>
            <Text style={styles.successTitle}>✓ Success!</Text>
            <Text style={styles.successMessage}>
              {submittedType === 'lost'
                ? 'Your report has been submitted for admin review.'
                : 'Successfully submitted!'}
            </Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff8e1',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    color: '#14258b',
  },
  progressContainer: {
    backgroundColor: '#d1ecf1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  progressText: {
    color: '#0c5460',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#bee5eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#17a2b8',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#14258b',
  },
  required: {
    color: '#dc3545',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  imageButton: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  imageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    marginTop: 12,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  helperText: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successModal: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  successContent: {
    backgroundColor: '#d4edda',
    borderWidth: 2,
    borderColor: '#28a745',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#155724',
    textAlign: 'center',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: '#155724',
    textAlign: 'center',
  },
  mt10: {
    marginTop: 10,
  },
});

export default Report;