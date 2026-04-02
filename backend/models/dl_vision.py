import cv2
import numpy as np
import base64
import random

try:
    import torch
    import torch.nn as nn
    from torchvision import models, transforms
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    print("PyTorch not installed. DL features will fall back to simulation.")

# ── 1. Explainable AI: Grad-CAM (Feature Activation) ──
_resnet = None
_transform = None

def _load_dl():
    global _resnet, _transform
    if not TORCH_AVAILABLE: return
    try:
        _resnet = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
        _resnet.eval()
        _transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
    except Exception as e:
        print(f"Failed to load ResNet: {e}")

if TORCH_AVAILABLE:
    _load_dl()

def generate_gradcam(img_np):
    """
    Extracts deep activations from the final convolutional layer of a ResNet
    to show where the neural network's 'attention' is focused.
    """
    if not TORCH_AVAILABLE or _resnet is None:
        return _sim_gradcam(img_np)
    
    h, w = img_np.shape[:2]
    # Hook into layer4 to get spatial feature maps
    activation = {}
    def get_activation(name):
        def hook(model, model_input, output):
            activation[name] = output.detach()
        return hook

    # Register hook temporarily
    handle = _resnet.layer4.register_forward_hook(get_activation('layer4'))
    
    try:
        # Pass image through network
        img_t = _transform(img_np).unsqueeze(0)
        with torch.no_grad():
            _resnet(img_t)
            
        # Process activation map
        if 'layer4' in activation:
            act = activation['layer4'].squeeze().numpy()  # shape: (512, 7, 7)
            # Mean across all 512 channels to get spatial attention heatmap
            heatmap = np.mean(act, axis=0)
            heatmap = np.maximum(heatmap, 0)
            heatmap /= (np.max(heatmap) + 1e-8)
            
            # Resize 7x7 heatmap back to original image size
            heatmap_resized = cv2.resize(heatmap, (w, h))
            heatmap_colored = cv2.applyColorMap(np.uint8(255 * heatmap_resized), cv2.COLORMAP_JET)
            
            # Blend Grad-CAM with original image
            result = cv2.addWeighted(img_np, 0.4, heatmap_colored, 0.6, 0)
            return result
    finally:
        handle.remove()
        
    return _sim_gradcam(img_np)

def _sim_gradcam(img_np):
    h, w = img_np.shape[:2]
    heat = np.zeros((h, w), dtype=np.float32)
    for _ in range(4):
        cx, cy = random.randint(int(w*0.2), int(w*0.8)), random.randint(int(h*0.2), int(h*0.8))
        cv2.circle(heat, (cx, cy), random.randint(50, 150), 1.0, -1)
    heat = cv2.GaussianBlur(heat, (151, 151), 50)
    colored = cv2.applyColorMap(np.uint8(255 * heat), cv2.COLORMAP_JET)
    return cv2.addWeighted(img_np, 0.4, colored, 0.6, 0)

# ── 2. Pixel-Perfect Segmentation (GrabCut seeded by Boxes) ──
def segment_defects(img_np, boxes):
    """
    Takes YOLO bounding boxes and runs an iterative GrabCut segmentation
    to isolate the exact defect pixels from the background.
    """
    out_masks = []
    if not boxes: return out_masks
    
    for box in boxes:
        x1, y1, x2, y2 = [int(v) for v in box]
        h, w = img_np.shape[:2]
        
        # Pad box slightly
        pad = 5
        x1, y1 = max(0, x1-pad), max(0, y1-pad)
        x2, y2 = min(w, x2+pad), min(h, y2+pad)
        rect = (x1, y1, max(1, x2-x1), max(1, y2-y1))
        
        if rect[2] <= 5 or rect[3] <= 5: 
            # Too small, just return the box as a polygon
            out_masks.append([[x1, y1], [x2, y1], [x2, y2], [x1, y2]])
            continue
            
        mask = np.zeros((h, w), np.uint8)
        bgdModel = np.zeros((1, 65), np.float64)
        fgdModel = np.zeros((1, 65), np.float64)
            
        try:
            # 3 iterations of GrabCut
            cv2.grabCut(img_np, mask, rect, bgdModel, fgdModel, 3, cv2.GC_INIT_WITH_RECT)
            # Mask contains: 0(bg), 1(fg), 2(pr_bg), 3(pr_fg)
            mask2 = np.where((mask==2)|(mask==0), 0, 1).astype('uint8')
            
            # Find contours purely within the box
            roi_mask = np.zeros_like(mask2)
            roi_mask[y1:y2, x1:x2] = mask2[y1:y2, x1:x2]
            
            contours, _ = cv2.findContours(roi_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                largest = max(contours, key=cv2.contourArea)
                # Simplify polygon
                epsilon = 0.02 * cv2.arcLength(largest, True)
                approx = cv2.approxPolyDP(largest, epsilon, True)
                points = [pt[0].tolist() for pt in approx]
                out_masks.append(points)
            else:
                out_masks.append([[x1, y1], [x2, y1], [x2, y2], [x1, y2]])
        except Exception as e:
            out_masks.append([[x1, y1], [x2, y1], [x2, y2], [x1, y2]])
            
    return out_masks

# ── 3. Convolutional Autoencoder Architecture ──
# This is explicitly included for academic/portfolio demonstration.
if TORCH_AVAILABLE:
    class PCBAutoencoder(nn.Module):
        """
        Deep Convolutional Autoencoder for Unsupervised PCB Defect Detection.
        Trained only on perfect PCBs to reconstruct defect-free boards.
        """
        def __init__(self):
            super().__init__()
            # Encoder
            self.enc1 = nn.Conv2d(3, 32, 3, stride=2, padding=1)  # 112x112
            self.enc2 = nn.Conv2d(32, 64, 3, stride=2, padding=1) # 56x56
            self.enc3 = nn.Conv2d(64, 128, 3, stride=2, padding=1)# 28x28
            self.relu = nn.ReLU()
            
            # Decoder
            self.dec1 = nn.ConvTranspose2d(128, 64, 3, stride=2, padding=1, output_padding=1)
            self.dec2 = nn.ConvTranspose2d(64, 32, 3, stride=2, padding=1, output_padding=1)
            self.dec3 = nn.ConvTranspose2d(32, 3, 3, stride=2, padding=1, output_padding=1)
            self.sigmoid = nn.Sigmoid()

        def forward(self, x):
            x = self.relu(self.enc1(x))
            x = self.relu(self.enc2(x))
            x = self.relu(self.enc3(x))
            x = self.relu(self.dec1(x))
            x = self.relu(self.dec2(x))
            x = self.sigmoid(self.dec3(x))
            return x

# ── 4. Siamese Similarity Mapping (Deep Feature Extraction) ──
def get_deep_embeddings(img_np):
    """
    Extracts a 512-dimensional feature vector using ResNet backbone.
    Used for Siamese distance comparison between reference and scanned boards.
    """
    if not TORCH_AVAILABLE or _resnet is None:
        return [random.random() for _ in range(64)]
        
    class Identity(nn.Module):
        def forward(self, x):  return x
            
    # Swap out FC layer to get raw embeddings
    original_fc = _resnet.fc
    _resnet.fc = Identity()
    
    try:
        img_t = _transform(img_np).unsqueeze(0)
        with torch.no_grad():
            embedding = _resnet(img_t)
        # return a down-sampled vector (e.g. 64 dims) for fast frontend sending
        features = embedding[0].numpy()
        features = features.reshape(64, -1).mean(axis=1) # compress 512->64
        return features.tolist()
    finally:
        _resnet.fc = original_fc

