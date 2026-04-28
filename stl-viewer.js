// stl-viewer.js — Универсальный 3D-просмотрщик STL для VK Mini Apps
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class STLViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error('Preview container not found');

        // Определяем тему
        this.isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Сцена
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.isDark ? 0x1a1a1a : 0xf4f6f8);

        // Камера
        this.camera = new THREE.PerspectiveCamera(
            45, 
            this.container.clientWidth / this.container.clientHeight, 
            0.1, 
            10000
        );
        this.camera.position.set(0, 0, 150);

        // Рендерер (preserveDrawingBuffer: true для скриншотов)
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            preserveDrawingBuffer: true,
            alpha: false
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        // Освещение
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(50, 50, 50);
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        this.scene.add(ambient, dirLight, hemiLight);

        // ✅ Сетка координат
        const gridSize = 200;
        const gridDiv = 20;
        this.grid = new THREE.GridHelper(
            gridSize, 
            gridDiv, 
            this.isDark ? 0x555555 : 0x888888, 
            this.isDark ? 0x333333 : 0x444444
        );
        this.grid.position.y = -50;
        this.scene.add(this.grid);

        // ✅ Оси координат (X=красный, Y=зелёный, Z=синий)
        this.axes = new THREE.AxesHelper(50);
        this.axes.position.y = -50;
        this.scene.add(this.axes);

        // Управление камерой
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 2000;
        this.controls.target.set(0, -20, 0);

        this.currentMesh = null;
        this.loader = new STLLoader();

        this.animate();
        this.onResize();
        window.addEventListener('resize', () => this.onResize());
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onResize = () => {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    async loadFromBlob(blob) {
        if (this.currentMesh) this.clear();
        
        const arrayBuffer = await blob.arrayBuffer();
        
        return new Promise((resolve, reject) => {
            this.loader.parse(arrayBuffer, '', (geometry) => {
                geometry.computeVertexNormals();
                geometry.center();
                
                const material = new THREE.MeshStandardMaterial({
                    color: 0x4a76a8,
                    roughness: 0.4,
                    metalness: 0.1,
                    flatShading: false
                });
                
                this.currentMesh = new THREE.Mesh(geometry, material);
                this.scene.add(this.currentMesh);
                
                this.fitCameraToObject(this.currentMesh);
                resolve();
            }, reject);
        });
    }

    fitCameraToObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        const fov = this.camera.fov * (Math.PI / 180);
        const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
        
        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        this.controls.target.copy(center);
        this.controls.update();
    }

    // ✅ Скриншот: генерирует PNG и скачивает его
    takeScreenshot() {
        this.renderer.render(this.scene, this.camera);
        const dataURL = this.renderer.domElement.toDataURL('image/png');
        
        const link = document.createElement('a');
        link.download = `3d-preview-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    }

    clear() {
        if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
            this.currentMesh.geometry.dispose();
            this.currentMesh.material.dispose();
            this.currentMesh = null;
        }
    }

    destroy() {
        window.removeEventListener('resize', this.onResize);
        this.clear();
        this.renderer.dispose();
        if (this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
}
