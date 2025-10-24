import { Picker } from '@react-native-picker/picker';
import { EmailAuthProvider, getAuth, onAuthStateChanged, reauthenticateWithCredential } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Alert as RNAlert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../../firebase/firebaseConfig';

type NavigationProp = {
  navigate: (screen: string) => void;
};

type FormData = {
  username: string;
  firstName: string;
  lastName: string;
  birthday: string;
  email: string;
  department: string;
  program: string;
  password: string;
};

type DepartmentKey = 'Senior High School' | 'SASE' | 'SBMA' | 'SECA';

const departments: DepartmentKey[] = ['Senior High School', 'SASE', 'SBMA', 'SECA'];
const programs: Record<DepartmentKey, string[]> = {
  'Senior High School': ['STEM', 'ABM'],
  SASE: ['ABComm', 'BSPS', 'BPEd'],
  SBMA: ['BSAccountancy', 'BSMA', 'BSHM', 'BSBA-HRM', 'MM', 'BSBA-FinMgt', 'BSBA-MktgMgt', 'BSTM'],
  SECA: ['BSCS-ML', 'BSCpE', 'BSArch', 'BSIT-MWA', 'BSCE'],
};

function EditProfileScreen({ navigation }: { navigation: NavigationProp }) {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    firstName: '',
    lastName: '',
    birthday: '',
    email: '',
    department: '',
    program: '',
    password: '',
  });
  const [userId, setUserId] = useState<string | null>(null);

  const [showChangeUsernameModal, setShowChangeUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameModalPassword, setUsernameModalPassword] = useState('');

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('');

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              username: data.username || '',
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              birthday: data.birthday || '',
              email: data.email || '',
              department: data.department || '',
              program: data.program || '',
              password: '',
            });
            setNewUsername(data.username || '');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        navigation.navigate('Login');
      }
    });
    return () => unsubscribe();
  }, [auth, navigation]);

  const handleChange = (name: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'department' ? { program: '' } : {}),
    }));
  };

  const showAlert = (message: string, type: string = 'info') => {
    setAlertMessage(message);
    setAlertType(type);
    setTimeout(() => {
      setAlertMessage('');
      setAlertType('');
    }, 3000);
  };

  const handleSubmit = async () => {
    if (!userId) return;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        birthday: formData.birthday || null,
        department: formData.department,
        program: formData.program,
      });
      showAlert('Profile updated successfully!', 'success');
    } catch (error) {
      console.error(error);
      showAlert('Failed to update profile', 'error');
    }
  };

  const handleChangeUsername = async () => {
    if (!userId) return;
    if (!newUsername || !usernameModalPassword) {
      RNAlert.alert('Error', 'Enter password to change username.');
      return;
    }
    try {
      const q = query(collection(db, 'users'), where('username', '==', newUsername));
      const snap = await getDocs(q);
      if (snap.docs.some(docSnap => docSnap.id !== userId)) {
        RNAlert.alert('Error', 'Username already taken');
        return;
      }
      if (auth.currentUser?.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, usernameModalPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }
      await updateDoc(doc(db, 'users', userId), { username: newUsername });
      setFormData(prev => ({ ...prev, username: newUsername }));
      setUsernameModalPassword('');
      RNAlert.alert('Success', 'Username updated!');
      setShowChangeUsernameModal(false);
    } catch (error) {
      console.error(error);
      RNAlert.alert('Error', 'Failed to update username');
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;

    if (!deletePassword) {
      RNAlert.alert('Error', 'Please enter your password');
      return;
    }

    try {
      if (auth.currentUser?.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, deletePassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { archived: true, archivedAt: new Date().toISOString() });

      if (auth.currentUser) {
        await auth.currentUser.delete();
      }
      await auth.signOut();
      navigation.navigate('Login');
    } catch (error: any) {
      console.error(error);
      let message = 'Failed to delete account. Please check your password.';
      if (error.code === 'auth/wrong-password') message = 'Incorrect password. Please try again.';
      RNAlert.alert('Error', message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>User Information</Text>

        {alertMessage !== '' && (
          <View style={[styles.alert, alertType === 'success' ? styles.alertSuccess : styles.alertError]}>
            <Text style={styles.alertText}>{alertMessage}</Text>
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={formData.firstName}
              onChangeText={(value) => handleChange('firstName', value)}
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={formData.lastName}
              onChangeText={(value) => handleChange('lastName', value)}
            />
          </View>
        </View>

        <Text style={styles.label}>Username</Text>
        <View style={styles.usernameRow}>
          <TextInput
            style={[styles.input, styles.disabledInput, { flex: 1 }]}
            value={formData.username}
            editable={false}
          />
          <TouchableOpacity onPress={() => setShowChangeUsernameModal(true)}>
            <Text style={styles.changeLink}>Change</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={formData.email}
          editable={false}
        />

        <Text style={styles.label}>Birthday</Text>
        <TextInput
          style={styles.input}
          value={formData.birthday}
          onChangeText={(value) => handleChange('birthday', value)}
          placeholder="YYYY-MM-DD"
        />

        <Text style={styles.label}>Department</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={formData.department}
            onValueChange={(value) => handleChange('department', value)}
            style={styles.picker}
          >
            <Picker.Item label="Select Department" value="" />
            {departments.map((d: DepartmentKey) => <Picker.Item key={d} label={d} value={d} />)}
          </Picker>
        </View>

        <Text style={styles.label}>Program</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={formData.program}
            onValueChange={(value) => handleChange('program', value)}
            style={styles.picker}
          >
            <Picker.Item label="Select Program" value="" />
            {(programs[formData.department as DepartmentKey] || []).map((p: string) => <Picker.Item key={p} label={p} value={p} />)}
          </Picker>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={() => setShowDeleteConfirmModal(true)}
          >
            <Text style={styles.buttonText}>Delete Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSubmit}
          >
            <Text style={styles.buttonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change Username Modal */}
      <Modal
        visible={showChangeUsernameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChangeUsernameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Username</Text>
            <Text style={styles.label}>New Username</Text>
            <TextInput
              style={styles.input}
              value={newUsername}
              onChangeText={setNewUsername}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={usernameModalPassword}
              onChangeText={setUsernameModalPassword}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowChangeUsernameModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleChangeUsername}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        visible={showDeleteConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Are you sure you want to delete your account?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteConfirmModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={() => {
                  setShowDeleteConfirmModal(false);
                  setShowDeletePasswordModal(true);
                }}
              >
                <Text style={styles.buttonText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Password Modal */}
      <Modal
        visible={showDeletePasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeletePasswordModal(false);
          setDeletePassword('');
          setShowDeleteConfirmModal(true);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter your password to confirm deletion</Text>
            <TextInput
              style={styles.input}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password"
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowDeletePasswordModal(false);
                  setDeletePassword('');
                  setShowDeleteConfirmModal(true);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9DB',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#14258b',
    textAlign: 'center',
    marginBottom: 20,
  },
  alert: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  alertSuccess: {
    backgroundColor: '#d4edda',
  },
  alertError: {
    backgroundColor: '#f8d7da',
  },
  alertText: {
    color: '#000',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfWidth: {
    flex: 1,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#333',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  disabledInput: {
    color: '#999',
    backgroundColor: '#f5f5f5',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  changeLink: {
    color: '#14258b',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  picker: {
    height: 50,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  saveButton: {
    backgroundColor: '#14258b',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#14258b',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  confirmButton: {
    backgroundColor: '#007bff',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default EditProfileScreen;