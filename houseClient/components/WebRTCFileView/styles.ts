import { StyleSheet } from 'react-native';

// Styles for the component
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginVertical: 10,
  },
  fileInfo: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  fileSize: {
    fontWeight: 'normal',
    color: '#666',
  },
  mimeType: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
});
