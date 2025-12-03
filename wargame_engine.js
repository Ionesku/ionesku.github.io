import { UNIT_TYPES, COUNTRIES, DIPLOMACY, generateName } from './wargame_data.js';
import { TerritoryManager } from './territory_manager.js';

// Вспомогательная функция для безопасной проверки войны между странами
function isAtWar(countryA, countryB) {
    if (!DIPLOMACY[countryA] || !DIPLOMACY[countryB]) return false;
    return DIPLOMACY[countryA][countryB] === 'war';
}

class Battle {
    constructor(id, lat, lon) {
        this.id = id;
        this.lat = lat;
        this.lon = lon;
        this.sideA = []; 
        this.sideB = []; 
        this.duration = 0;
    }

    hasUnit(unit) {
        return this.sideA.includes(unit) || this.sideB.includes(unit);
    }

    addUnit(unit, side) {
        if (side === 'A') {
            if (this.sideA.length >= 12) return false;
            this.sideA.push(unit);
        } else {
            if (this.sideB.length >= 12) return false;
            this.sideB.push(unit);
        }
        unit.state = 'fighting';
        unit.battleId = this.id;
        return true;
    }

    removeUnit(unit) {
        this.sideA = this.sideA.filter(u => u !== unit);
        this.sideB = this.sideB.filter(u => u !== unit);
        unit.battleId = null;
    }

    isEmpty() {
        return this.sideA.length === 0 || this.sideB.length === 0;
    }
}

export class WargameEngine {
    constructor(tileEngine) {
        this.te = tileEngine; 
        this.units = [];
        this.depots = [];
        this.airfields = [];
        this.battles = [];
        this.garrisons = []; 
        this.events = [];
        this.paused = false;
        this.speedMultiplier = 1;
        
        this.gameTime = new Date(1939, 8, 1).getTime();
        this.baseTimeSpeed = 1000 * 60 * 60; // 1 hour per tick at 1x

        this.territoryManager = new TerritoryManager();
        this.initScenario();
    }

    setSpeed(multiplier) {
        this.speedMultiplier = multiplier;
    }

    initScenario() {
        Object.keys(COUNTRIES).forEach(countryId => {
            const c = COUNTRIES[countryId];
            
            this.depots.push({
                id: `depot_${countryId}_main`,
                country: countryId,
                lat: c.capital.lat,
                lon: c.capital.lon,
                supply: 100000,
                radius: 500 
            });

            this.airfields.push({
                id: `air_${countryId}_main`,
                country: countryId,
                lat: c.capital.lat + 0.1,
                lon: c.capital.lon + 0.1,
            });

            const armySize = (countryId === 'germany' || countryId === 'ussr') ? 40 : 30;
            
            for (let i = 0; i < armySize; i++) {
                const type = (Math.random() > 0.7 && countryId === 'germany') ? UNIT_TYPES.TANK : UNIT_TYPES.INFANTRY;
                let lat, lon;

                if (c.front_line_start && c.front_line_end && (countryId === 'germany' || countryId === 'france')) {
                    const t = Math.random();
                    const depth = (countryId === 'germany' ? 0.5 : -0.5) * Math.random(); 
                    
                    lat = c.front_line_start.lat + (c.front_line_end.lat - c.front_line_start.lat) * t + depth;
                    lon = c.front_line_start.lon + (c.front_line_end.lon - c.front_line_start.lon) * t + depth;
                } else {
                    lat = c.capital.lat + (Math.random() - 0.5) * 3;
                    lon = c.capital.lon + (Math.random() - 0.5) * 5;
                }

                this.units.push(this.createUnit(countryId, type, lat, lon));
            }

            for (let i = 0; i < 6; i++) {
                 this.units.push(this.createUnit(countryId, UNIT_TYPES.PLANE, c.capital.lat, c.capital.lon));
            }

            if (c.naval_spawns) {
                c.naval_spawns.forEach(spawn => {
                    this.units.push(this.createUnit(countryId, UNIT_TYPES.SHIP, spawn.lat, spawn.lon));
                });
            }
        });
        
        this.log("ВОЙНА НАЧАЛАСЬ. ГЕРМАНИЯ И ФРАНЦИЯ ВСТУПИЛИ В БОЙ.", true);
    }

    createUnit(country, type, lat, lon) {
        return {
            id: Math.random().toString(36).substr(2, 9),
            name: generateName(country),
            country: country,
            type: type,
            lat: lat,
            lon: lon,
            targetLat: null,
            targetLon: null,
            state: 'idle',
            strength: 100,
            morale: 100,
            supply: 100,
            heading: 0,
            battleId: null
        };
    }

    // Гарнизоны больше не нужны - территории отслеживаются через TerritoryManager
    // createGarrison удалён

    log(msg, isMajor = false) {
        // Anti-spam
        if (!isMajor && Math.random() > 0.1) return; 

        const timeStr = new Date(this.gameTime).toLocaleDateString('ru-RU');
        const style = isMajor ? 'color: #ffaa00; font-weight: bold; text-transform: uppercase; margin: 4px 0;' : '';
        const formattedMsg = `<span style="${style}">[${timeStr}] ${msg}</span>`;
        
        this.events.unshift(formattedMsg);
        if (this.events.length > 30) this.events.pop();
        
        const logEl = document.getElementById('gameLog');
        if (logEl) {
            logEl.innerHTML = this.events.join('<br>');
        }
    }

    updateDateDisplay() {
        const el = document.getElementById('gameDate');
        if (el) {
            el.textContent = new Date(this.gameTime).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    tick() {
        if (this.paused) return;
        
        const iterations = Math.floor(this.speedMultiplier);
        for (let k = 0; k < iterations; k++) {
             this.simulateTick();
        }
        this.updateDateDisplay();
    }

    simulateTick() {
        const oldDate = new Date(this.gameTime);
        this.gameTime += this.baseTimeSpeed;
        const newDate = new Date(this.gameTime);

        // Daily update for territory boundaries
        if (newDate.getDate() !== oldDate.getDate()) {
             // this.territoryManager.rebuildBorders(this.te); // Method removed
        }

        this.processBattles();

        this.units.forEach(unit => {
            if (unit.strength <= 0) return;

            this.checkSupply(unit);
            this.aiThink(unit);
            this.moveUnit(unit);

            if (unit.state !== 'fighting' && unit.type.type === 'land') {
                this.checkForCombat(unit);
            }
        });

        this.units = this.units.filter(u => u.strength > 0);
        
        // CLEANUP FINISHED BATTLES
        // When a battle ends (one side empty), release the winners so they can move again
        for (let i = this.battles.length - 1; i >= 0; i--) {
            const b = this.battles[i];
            if (b.isEmpty()) {
                // Everyone left in the battle is a winner (or the last survivors)
                const survivors = [...b.sideA, ...b.sideB];
                
                // Territory Conquest
                if (survivors.length > 0) {
                    const winnerCountry = survivors[0].country;
                    this.territoryManager.conquer(b.lat, b.lon, winnerCountry);
                }

                survivors.forEach(u => {
                    u.state = 'idle';
                    u.battleId = null;
                    u.morale = Math.min(100, u.morale + 5); // Victory boost
                });
                this.battles.splice(i, 1);
            }
        }
    }

    processBattles() {
        this.battles.forEach(battle => {
            battle.duration++;

            let airSupportA = 0;
            let airSupportB = 0;
            
            this.units.filter(u => u.type.id === 'plane' && u.strength > 0).forEach(plane => {
                const d = this.dist(plane.lat, plane.lon, battle.lat, battle.lon);
                if (d < 1.0) {
                    if (battle.sideA.length > 0 && battle.sideA[0].country === plane.country) airSupportA++;
                    if (battle.sideB.length > 0 && battle.sideB[0].country === plane.country) airSupportB++;
                }
            });

            const applyRound = (attackers, defenders, airBonus) => {
                if (attackers.length === 0 || defenders.length === 0) return;
                
                const totalAttack = attackers.reduce((sum, u) => sum + u.type.attack * (u.strength/100) * (u.morale/100), 0);
                const totalDefense = defenders.reduce((sum, u) => sum + u.type.defense * (u.strength/100) * (u.morale/100), 0);
                
                const damageBase = Math.max(1, totalAttack - totalDefense * 0.5);
                const damageFinal = damageBase * (1 + airBonus * 0.2); 

                const target = defenders[Math.floor(Math.random() * defenders.length)];
                target.strength -= damageFinal * 0.1; 
                target.morale -= damageFinal * 0.05;
                target.supply -= 0.5;

                if (target.strength <= 0) {
                    this.log(`ПОТЕРЯ: ${target.name} погиб в бою!`, true);
                    battle.removeUnit(target);
                    attackers.forEach(a => a.morale = Math.min(100, a.morale + 10));
                } else if (target.morale < 15) {
                    this.log(`${target.name} паникует и бежит с поля боя!`);
                    battle.removeUnit(target);
                    target.state = 'retreating';
                    const cap = COUNTRIES[target.country].capital;
                    target.targetLat = cap.lat;
                    target.targetLon = cap.lon;
                }
            };

            applyRound(battle.sideA, battle.sideB, airSupportA);
            applyRound(battle.sideB, battle.sideA, airSupportB);
        });
    }

    checkForCombat(unit) {
        const enemies = this.units.filter(u => 
            u.country !== unit.country && 
            isAtWar(unit.country, u.country) &&
            u.strength > 0 &&
            u.type.type === 'land' &&
            this.dist(unit.lat, unit.lon, u.lat, u.lon) < 0.1 
        );

        if (enemies.length > 0) {
            const enemy = enemies[0];
            
            if (enemy.battleId) {
                const battle = this.battles.find(b => b.id === enemy.battleId);
                if (battle) {
                    const side = battle.sideA.includes(enemy) ? 'B' : 'A';
                    if (battle.addUnit(unit, side)) {
                        // joined
                    }
                }
            } else {
                const battle = new Battle(Math.random(), unit.lat, unit.lon);
                battle.addUnit(unit, 'A');
                battle.addUnit(enemy, 'B');
                this.battles.push(battle);
                this.log(`НАЧАЛО БОЯ: ${unit.name} против ${enemy.name}`, true);
            }
        }
    }

    checkSupply(unit) {
        unit.supply -= unit.type.supply_usage * 0.005;
        
        let nearbyDepot = this.depots.find(d => {
            if (d.country !== unit.country) return false;
            return this.dist(unit.lat, unit.lon, d.lat, d.lon) < 2.0; 
        });

        if (unit.state === 'recovering' || nearbyDepot) {
            unit.supply = Math.min(100, unit.supply + 2);
            unit.strength = Math.min(100, unit.strength + 0.5);
            unit.morale = Math.min(100, unit.morale + 1);
        }

        if (unit.supply <= 0) {
            unit.morale -= 0.2;
            unit.supply = 0;
        }
    }

    aiThink(unit) {
        if (unit.state === 'fighting') return; 

        if (unit.type.id === 'plane') {
            if (unit.supply < 30) {
                const airfield = this.airfields.find(a => a.country === unit.country);
                if (airfield) {
                    unit.targetLat = airfield.lat;
                    unit.targetLon = airfield.lon;
                    unit.state = 'moving';
                }
                return;
            }
            
            const battle = this.battles.find(b => {
                const hasFriend = (b.sideA.length && b.sideA[0].country === unit.country) || 
                                  (b.sideB.length && b.sideB[0].country === unit.country);
                return hasFriend;
            });

            if (battle) {
                unit.targetLat = battle.lat;
                unit.targetLon = battle.lon;
                unit.state = 'moving';
                return;
            }
            
            const enemy = this.units.find(u => u.country !== unit.country && isAtWar(u.country, unit.country) && u.strength > 0);
            if (enemy) {
                unit.targetLat = enemy.lat;
                unit.targetLon = enemy.lon;
                unit.state = 'moving';
                
                if (this.dist(unit.lat, unit.lon, enemy.lat, enemy.lon) < 0.2) {
                    enemy.strength -= 0.5;
                    enemy.morale -= 0.5;
                }
            }
            return;
        }

        if (unit.type.id === 'ship') {
             if (unit.state === 'idle') {
                 unit.targetLat = unit.lat + (Math.random() - 0.5) * 0.5;
                 unit.targetLon = unit.lon + (Math.random() - 0.5) * 0.5;
                 unit.state = 'moving';
             }
             return;
        }

        // LAND UNITS
        
        if (unit.strength < 30 || unit.morale < 20) {
            unit.state = 'retreating';
        }

        if (unit.state === 'retreating') {
            const cap = COUNTRIES[unit.country].capital;
            // RETREAT LOGIC: Don't run all the way home. Run 2.0 units towards home, then stop.
            // Calculate vector to capital
            const dLat = cap.lat - unit.lat;
            const dLon = cap.lon - unit.lon;
            const totalDist = Math.sqrt(dLat*dLat + dLon*dLon);
            
            // Target is a point 2.0 units away towards capital (or capital itself if closer)
            const retreatDist = Math.min(totalDist, 2.0);
            const ratio = retreatDist / totalDist;
            
            unit.targetLat = unit.lat + dLat * ratio;
            unit.targetLon = unit.lon + dLon * ratio;
            
            return;
        }

        if (unit.state === 'recovering') {
            if (unit.strength > 90 && unit.morale > 90) {
                unit.state = 'idle'; 
            } else {
                return; 
            }
        }

        // SAFE CHECK for Battles
        const nearbyBattle = this.battles.find(b => {
            const d = this.dist(unit.lat, unit.lon, b.lat, b.lon);
            
            // Ensure side arrays are safe to access
            const sideAValid = b.sideA && b.sideA.length > 0;
            const sideBValid = b.sideB && b.sideB.length > 0;

            // Join if our side isn't full (limit 12)
            const sideAFull = sideAValid && b.sideA.length >= 12 && b.sideA[0].country === unit.country;
            const sideBFull = sideBValid && b.sideB.length >= 12 && b.sideB[0].country === unit.country;
            
            return d < 2.0 && !(sideAFull || sideBFull);
        });

        if (nearbyBattle) {
            unit.targetLat = nearbyBattle.lat;
            unit.targetLon = nearbyBattle.lon;
            unit.state = 'moving';
            return;
        }

        const enemies = this.units.filter(u => u.country !== unit.country && isAtWar(unit.country, u.country) && u.type.type === 'land');
        let nearestEnemy = null;
        let minD = Infinity;

        // FRONT LINE LOGIC:
        // Instead of finding the absolute nearest enemy, find the nearest enemy CLUSTER to avoid running into 1 guy
        // Simple version: Look for nearest enemy, but prioritize enemies that are roughly IN FRONT of us (towards enemy capital)
        
        enemies.forEach(e => {
            const d = this.dist(unit.lat, unit.lon, e.lat, e.lon);
            if (d < minD) { minD = d; nearestEnemy = e; }
        });

        if (unit.state === 'moving' && !nearestEnemy) {
             // If moving but no enemy, check if we are just patrolling or actually going somewhere
             // Reduce jitter by not re-picking target every frame unless we are very close to old target
             if (unit.targetLat !== null) {
                 const distToTarget = this.dist(unit.lat, unit.lon, unit.targetLat, unit.targetLon);
                 if (distToTarget > 0.5) return; // Keep moving
             }
        }

        if (nearestEnemy && minD < 2.5) { // Increased detection range
            // Count nearby allies to make a better decision
            const nearbyAllies = this.units.filter(u => 
                u.country === unit.country && 
                u.strength > 20 &&
                this.dist(u.lat, u.lon, unit.lat, unit.lon) < 1.0
            ).length;

            // FLANKING / SPREAD LOGIC:
            // If too many allies are targeting the EXACT same spot, offset our target slightly
            // This creates a "Front Line" naturally
            let targetLat = nearestEnemy.lat;
            let targetLon = nearestEnemy.lon;

            if (nearbyAllies > 3) {
                // Spread out!
                // Calculate perpendicular vector to enemy
                const dx = nearestEnemy.lat - unit.lat;
                const dy = nearestEnemy.lon - unit.lon;
                // Perpendicular: (-dy, dx)
                const spreadFactor = (Math.random() - 0.5) * 0.5; 
                targetLat += -dy * spreadFactor;
                targetLon += dx * spreadFactor;
            }

            if (unit.strength > 30 || nearbyAllies > 0 || Math.random() > 0.3) {
                unit.targetLat = targetLat;
                unit.targetLon = targetLon;
                unit.state = 'moving';
            } else {
                unit.state = 'retreating'; 
            }
        } else {
            // NO ENEMIES NEARBY?
            // CONQUEST MODE: Spread out over the entire enemy country
            const enemyCountryId = unit.country === 'germany' ? 'france' : 'germany'; 
            const enemyCap = COUNTRIES[enemyCountryId].capital;
            
            // WIDER TARGETING: +/- 5.0 degrees (covers most of France/Germany)
            // This ensures they don't all clump at the capital
            unit.targetLat = enemyCap.lat + (Math.random() - 0.5) * 10.0; 
            unit.targetLon = enemyCap.lon + (Math.random() - 0.5) * 10.0;
            
            // CAPTURE LOGIC: If we are deep in enemy land and near capital, pretend we are securing it
            const distToCap = this.dist(unit.lat, unit.lon, enemyCap.lat, enemyCap.lon);
            if (distToCap < 2.0) {
                 // Force a patrol movement to a random nearby point to "secure area"
                 unit.targetLat = enemyCap.lat + (Math.random() - 0.5) * 3.0;
                 unit.targetLon = enemyCap.lon + (Math.random() - 0.5) * 3.0;
            }
            
            unit.state = 'moving';
        }

        // FORMATION KEEPING (The Glue)

        const allies = this.units.filter(u => u.country === unit.country && u !== unit && u.type.type === 'land' && this.dist(u.lat, u.lon, unit.lat, unit.lon) < 0.2);
        if (allies.length > 0 && unit.state === 'moving') {
             let pushLat = 0, pushLon = 0;
             allies.forEach(a => {
                 pushLat += (unit.lat - a.lat);
                 pushLon += (unit.lon - a.lon);
             });
             unit.targetLat += pushLat * 0.5;
             unit.targetLon += pushLon * 0.5;
        }
        
        // Территория захватывается автоматически при движении через TerritoryManager
    }

    // NEW: Check bounds to prevent entering neutral countries (Simple Box for Switzerland & Benelux)
    isTerritoryAllowed(lat, lon) {
        // Switzerland (Rough box)
        if (lat > 45.8 && lat < 47.8 && lon > 6.0 && lon < 10.5) return false;
        
        // Belgium / Netherlands / Luxembourg (Benelux)
        // Prevent movement North of France/West of Germany.
        // Roughly: Lat > 49.5 (Luxembourg city) AND Lon < 6.1 (German Border)
        // This stops the "Schlieffen Plan" loop through Belgium
        if (lat > 49.5 && lon < 6.15) return false;

        return true;
    }

    moveUnit(unit) {
        if (unit.state !== 'moving' && unit.state !== 'retreating') return;
        if (unit.targetLat === null) return;

        const dLat = unit.targetLat - unit.lat;
        const dLon = unit.targetLon - unit.lon;
        const dist = Math.sqrt(dLat*dLat + dLon*dLon);

        if (dist < 0.02) {
            if (unit.state === 'retreating') {
                 // Find nearby friends to regroup with
                 const nearbyFriend = this.units.find(u => 
                    u !== unit && u.country === unit.country && u.state !== 'retreating' && 
                    this.dist(u.lat, u.lon, unit.lat, unit.lon) < 0.5
                 );
                 
                 if (nearbyFriend) {
                     this.log(`${unit.name} перегруппировался с ${nearbyFriend.name}`, false);
                     unit.state = 'idle'; // Ready to fight again
                 } else {
                     unit.state = 'recovering';
                 }
            }
            else unit.state = 'idle';
            return;
        }

        const speed = unit.type.speed * (unit.morale / 100);
        const step = speed * 0.05; 
        
        let moveLat = (dLat / dist) * step;
        let moveLon = (dLon / dist) * step;

        // Predict next position
        const nextLat = unit.lat + moveLat;
        const nextLon = unit.lon + moveLon;

        // Physics & Border Check
        if (this.isTerritoryAllowed(nextLat, nextLon)) {
            unit.lat = nextLat;
            unit.lon = nextLon;
            
            // OCCUPATION LOGIC: Захват территории при продвижении
            // Захватываем ТОЛЬКО территорию врага
            const currentOwner = this.territoryManager.getOwner(unit.lat, unit.lon);
            if (currentOwner !== unit.country) {
                this.territoryManager.conquer(unit.lat, unit.lon, unit.country);
            }
        } else {
            // Hit a border/neutral zone - stop and rethink
            unit.state = 'idle';
            unit.targetLat = null; // Reset target to force new AI decision
        }
        
        unit.heading = Math.atan2(dLon, dLat);
    }

    dist(lat1, lon1, lat2, lon2) {
        return Math.sqrt(Math.pow(lat1-lat2, 2) + Math.pow(lon1-lon2, 2));
    }

    drawMilitaryArrow(ctx, x1, y1, x2, y2, w, hw, hl, color) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx*dx + dy*dy);
        
        // If arrow is shorter than head, scale down head
        const actualHl = Math.min(hl, len * 0.6);
        const actualHw = hw;
        
        const angle = Math.atan2(dy, dx);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        // Rotate point p relative to (x1, y1)
        const r = (x, y) => ({
            x: x * cos - y * sin + x1,
            y: x * sin + y * cos + y1
        });

        const shaftLen = len - actualHl;

        ctx.beginPath();
        // 7 points of an arrow
        const p1 = r(0, -w/2);              // Base Top
        const p2 = r(shaftLen, -w/2);       // Shaft Top
        const p3 = r(shaftLen, -actualHw/2);// Head Wing Top
        const p4 = r(len, 0);               // Tip
        const p5 = r(shaftLen, actualHw/2); // Head Wing Bottom
        const p6 = r(shaftLen, w/2);        // Shaft Bottom
        const p7 = r(0, w/2);               // Base Bottom

        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.lineTo(p5.x, p5.y);
        ctx.lineTo(p6.x, p6.y);
        ctx.lineTo(p7.x, p7.y);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7; // Slightly transparent arrows
        ctx.fill();
        
        // Outline for contrast
        ctx.lineWidth = 1 / this.te.transform.k; // Thin pixel line
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.stroke();
    }

    draw(ctx, transform) {
        this.territoryManager.draw(ctx, this.te);

        const project = (lat, lon) => {
            const [wx, wy] = this.te.latLonToWorld(lat, lon);
            return { x: wx, y: wy };
        };

        const allPoints = [
            ...this.units.filter(u => u.type.type === 'land'),
            ...this.depots
        ];

        if (allPoints.length > 2 && d3.Delaunay) {
             // Territory Control (Voronoi/Gradients) removed for performance.
        }
    }

    drawTerritories(ctx, transform) {
        this.territoryManager.draw(ctx, this.te);
    }

    drawUnits(ctx, transform) {
        const project = (lat, lon) => {
            const [wx, wy] = this.te.latLonToWorld(lat, lon);
            return { x: wx, y: wy };
        };

        // 2. Draw Attack Arrows (Military Maps style - Fat Arrows for Groups)
        ctx.save();
        
        const arrowShaftWidth = 8 / transform.k; 
        const arrowHeadWidth = 20 / transform.k;
        const arrowHeadLen = 25 / transform.k;

        // Group units for arrow drawing
        // Criteria: Same country, state=moving, target!=null, and close to each other
        const movingUnits = this.units.filter(u => u.state === 'moving' && u.targetLat !== null);
        const groups = [];
        const processed = new Set();

        movingUnits.forEach(u => {
            if (processed.has(u)) return;

            const group = [u];
            processed.add(u);

            const startU = project(u.lat, u.lon);
            const targetU = project(u.targetLat, u.targetLon);
            
            // Find nearby friends moving roughly to same area
            movingUnits.forEach(v => {
                if (processed.has(v) || v.country !== u.country) return;
                
                const startV = project(v.lat, v.lon);
                const targetV = project(v.targetLat, v.targetLon);
                
                const distStart = Math.sqrt(Math.pow(startU.x - startV.x, 2) + Math.pow(startU.y - startV.y, 2));
                
                // If close enough (e.g. 30 world units)
                if (distStart < 30) { 
                        group.push(v);
                        processed.add(v);
                }
            });
            groups.push(group);
        });

        groups.forEach(group => {
            const u = group[0];
            
            // Calculate Centroids
            let avgX = 0, avgY = 0, avgTX = 0, avgTY = 0;
            group.forEach(unit => {
                    const s = project(unit.lat, unit.lon);
                    const t = project(unit.targetLat, unit.targetLon);
                    avgX += s.x; avgY += s.y;
                    avgTX += t.x; avgTY += t.y;
            });
            avgX /= group.length; avgY /= group.length;
            avgTX /= group.length; avgTY /= group.length;
            
            const dist = Math.sqrt(Math.pow(avgTX - avgX, 2) + Math.pow(avgTY - avgY, 2));

            if (dist > arrowHeadLen * 0.5) {
                const color = COUNTRIES[u.country].accent; 
                
                // Scale arrow based on group size?
                const sizeFactor = Math.min(2.5, 0.8 + group.length * 0.1); 
                
                this.drawMilitaryArrow(ctx, avgX, avgY, avgTX, avgTY, 
                    arrowShaftWidth * sizeFactor, 
                    arrowHeadWidth * sizeFactor, 
                    arrowHeadLen * sizeFactor, 
                    color);
            }
        });
        ctx.restore();


        this.battles.forEach(b => {
            const pos = project(b.lat, b.lon);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            const scale = 1 / transform.k;
            
            const pulse = (Date.now() % 1000) / 1000;
            ctx.beginPath();
            ctx.arc(0, 0, 30 * scale * (1 + pulse * 0.5), 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = `bold ${20*scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("⚔️", 0, 0);
            
            ctx.restore();
        });

        const scale = 1 / transform.k; 
        const iconSize = 14 * scale; 

        this.units.forEach(unit => {
            const pos = project(unit.lat, unit.lon);
            
            ctx.save();
            ctx.translate(pos.x, pos.y);
            
            if (this.te.hoveredUnit === unit) {
                ctx.shadowColor = 'white';
                ctx.shadowBlur = 10;
            }

            ctx.beginPath();
            ctx.arc(0, 0, iconSize, 0, Math.PI*2);
            ctx.fillStyle = COUNTRIES[unit.country].color;
            ctx.fill();
            
            ctx.strokeStyle = (unit.strength < 50) ? '#ff0000' : '#fff';
            ctx.lineWidth = 1.5 * scale;
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.floor(iconSize)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(unit.type.icon_char, 0, 1 * scale);

            if (unit.state === 'retreating') {
                ctx.fillStyle = 'yellow';
                ctx.font = `${10*scale}px sans-serif`;
                ctx.fillText("!", iconSize, -iconSize);
            }
            if (unit.state === 'recovering') {
                ctx.fillStyle = '#00ff00';
                ctx.font = `${10*scale}px sans-serif`;
                ctx.fillText("+", iconSize, -iconSize);
            }

            ctx.restore();
        });
    }

    draw(ctx, transform) {
        // Legacy draw method, replaced by separate calls in model.html
        this.drawTerritories(ctx, transform);
        this.drawUnits(ctx, transform);
    }
}
