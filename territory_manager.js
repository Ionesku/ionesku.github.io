import { COUNTRIES, DIPLOMACY } from './wargame_data.js';

/**
 * TerritoryManager - рисует захваченную территорию
 * Захватывает ТОЛЬКО территорию врага, не нейтралов
 */
export class TerritoryManager {
    constructor(cellSize = 0.05) { 
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    getGridCoord(lat, lon) {
        return {
            x: Math.floor(lon / this.cellSize),
            y: Math.floor(lat / this.cellSize)
        };
    }

    getKey(x, y) {
        return `${x},${y}`;
    }

    getOwner(lat, lon) {
        const { x, y } = this.getGridCoord(lat, lon);
        const key = this.getKey(x, y);
        const cell = this.grid.get(key);
        return cell ? cell.country : null;
    }

    /**
     * Проверяет является ли страна врагом захватчика
     */
    isEnemy(attackerCountry, targetCountry) {
        if (!targetCountry || !attackerCountry) return false;
        if (attackerCountry === targetCountry) return false;
        
        if (DIPLOMACY[attackerCountry] && DIPLOMACY[attackerCountry][targetCountry] === 'war') {
            return true;
        }
        return false;
    }

    /**
     * Примерное определение страны по координатам
     */
    guessCountryByCoords(lat, lon) {
        // 1. Check Neutrals FIRST
        
        // Switzerland
        if (lat > 45.8 && lat < 47.8 && lon > 6.0 && lon < 10.5) return null;

        // Luxembourg
        if (lat > 49.4 && lat < 50.2 && lon > 5.7 && lon < 6.6) return null;

        // Belgium
        if (lat > 49.5 && lat < 51.5 && lon > 2.5 && lon < 6.4) return null;
        // Netherlands
        if (lat > 50.7 && lat < 53.7 && lon > 3.3 && lon < 7.2) return null;


        // 2. Check Majors
        
        // Франция
        if (lat >= 42 && lat <= 51 && lon >= -5 && lon <= 8) return 'france';
        // Германия
        if (lat >= 47 && lat <= 55 && lon >= 6 && lon <= 15) return 'germany';
        // Польша
        if (lat >= 49 && lat <= 55 && lon >= 14 && lon <= 24) return 'poland';
        // СССР
        if (lon >= 24) return 'ussr';
        // UK
        if (lon <= -1 && lat >= 50) return 'uk';
        
        return null; // Нейтральная или неизвестная
    }

    /**
     * Захватывает территорию с заполнением пустот (Xonix-like)
     */
    conquer(lat, lon, countryId) {
        const { x, y } = this.getGridCoord(lat, lon);
        
        // Capture Radius
        const radius = 2; 
        let changed = false;

        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (dx*dx + dy*dy > radius*radius) continue;

                const cellX = x + dx;
                const cellY = y + dy;
                
                if (this.tryConquerCell(cellX, cellY, countryId)) {
                    changed = true;
                }
            }
        }

        // "Xonix" Fill: If we took new ground, try to connect to nearby friendly ground
        // This fills the "holes" inside the formation
        if (changed) {
            this.scanlineFill(x, y, countryId);
        }
    }

    tryConquerCell(x, y, countryId) {
        const key = this.getKey(x, y);
        const existing = this.grid.get(key);
        
        // Already ours
        if (existing && existing.country === countryId) return false;

        const cellLat = (y + 0.5) * this.cellSize;
        const cellLon = (x + 0.5) * this.cellSize;
        const ownerId = this.guessCountryByCoords(cellLat, cellLon);
        
        // Cannot conquer Neutrals
        if (!ownerId) return false; 
        
        this.grid.set(key, {
            country: countryId,
            originalOwner: ownerId,
            timestamp: Date.now()
        });
        return true;
    }

    scanlineFill(cx, cy, countryId) {
        // Look for "bridges" to other friendly cells
        const range = 20; // ~1.0 degree gap closing
        const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]; 

        for (const [dx, dy] of dirs) {
             this.fillDirection(cx, cy, dx, dy, range, countryId);
             this.fillDirection(cx, cy, -dx, -dy, range, countryId);
        }
    }

    fillDirection(x, y, dx, dy, range, countryId) {
        let anchorFound = false;
        let gapSize = 0;
        
        // Scan ahead
        for (let i = 1; i <= range; i++) {
            const tx = x + dx * i;
            const ty = y + dy * i;
            const key = this.getKey(tx, ty);
            const cell = this.grid.get(key);
            
            if (cell && cell.country === countryId) {
                anchorFound = true;
                gapSize = i - 1;
                break;
            }
        }

        // If found a friend, fill everything in between
        if (anchorFound && gapSize > 0) {
            for (let i = 1; i <= gapSize; i++) {
                const tx = x + dx * i;
                const ty = y + dy * i;
                this.tryConquerCell(tx, ty, countryId);
            }
        }
    }

    filterIsolated(cells) {
        const valid = new Set();
        for (const key of cells) {
            const [x, y] = key.split(',').map(Number);
            let neighbors = 0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    if (cells.has(this.getKey(x + dx, y + dy))) neighbors++;
                }
            }
            if (neighbors >= 2) valid.add(key);
        }
        return valid;
    }

    traceBoundaries(cells) {
        const edges = new Map();
        for (const key of cells) {
            const [cx, cy] = key.split(',').map(Number);
            if (!cells.has(this.getKey(cx, cy-1))) edges.set(`${cx},${cy}`, {x: cx+1, y: cy});
            if (!cells.has(this.getKey(cx+1, cy))) edges.set(`${cx+1},${cy}`, {x: cx+1, y: cy+1});
            if (!cells.has(this.getKey(cx, cy+1))) edges.set(`${cx+1},${cy+1}`, {x: cx, y: cy+1});
            if (!cells.has(this.getKey(cx-1, cy))) edges.set(`${cx},${cy+1}`, {x: cx, y: cy});
        }

        const paths = [];
        while (edges.size > 0) {
            const startKey = edges.keys().next().value;
            const path = [];
            let currKey = startKey;
            let iterations = 0;

            while (edges.has(currKey) && iterations < 10000) {
                const [x, y] = currKey.split(',').map(Number);
                path.push({x, y});
                const nextPt = edges.get(currKey);
                edges.delete(currKey);
                currKey = `${nextPt.x},${nextPt.y}`;
                iterations++;
                if (currKey === startKey) break;
            }
            if (path.length > 2) paths.push(path);
        }
        return paths;
    }

    pathSmooth(ctx, path, tileEngine) {
        if (path.length < 3) return;
        const worldPoints = path.map(p => {
            const lon = p.x * this.cellSize;
            const lat = p.y * this.cellSize;
            return tileEngine.latLonToWorld(lat, lon);
        });
        const len = worldPoints.length;
        const p0 = worldPoints[0];
        const pLast = worldPoints[len - 1];
        const startMx = (pLast[0] + p0[0]) / 2;
        const startMy = (pLast[1] + p0[1]) / 2;

        ctx.moveTo(startMx, startMy);
        for (let i = 0; i < len; i++) {
            const pCurrent = worldPoints[i];
            const pNext = worldPoints[(i + 1) % len];
            const midX = (pCurrent[0] + pNext[0]) / 2;
            const midY = (pCurrent[1] + pNext[1]) / 2;
            ctx.quadraticCurveTo(pCurrent[0], pCurrent[1], midX, midY);
        }
        ctx.closePath();
    }

    draw(ctx, tileEngine) {
        if (this.grid.size === 0) return;
        const transform = tileEngine.transform;
        ctx.save();
        
        const byCountry = new Map();
        for (const [key, data] of this.grid) {
            if (!byCountry.has(data.country)) byCountry.set(data.country, new Set());
            byCountry.get(data.country).add(key);
        }
        
        for (const [countryId, allCells] of byCountry) {
            const country = COUNTRIES[countryId];
            if (!country) continue;
            
            const cells = this.filterIsolated(allCells);
            if (cells.size === 0) continue;
            
            const mapColor = tileEngine.getCountryColor(country.name_en);
            const boundaryPaths = this.traceBoundaries(cells);
            
            // OPAQUE Fill
            ctx.fillStyle = mapColor;
            ctx.globalAlpha = 1.0; 
            ctx.beginPath();
            for (const path of boundaryPaths) this.pathSmooth(ctx, path, tileEngine);
            ctx.fill("evenodd");
            
            // Border Stroke
            ctx.lineWidth = 1.5 / transform.k;
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            for (const path of boundaryPaths) this.pathSmooth(ctx, path, tileEngine);
            ctx.stroke();
        }
        ctx.restore();
    }
}
