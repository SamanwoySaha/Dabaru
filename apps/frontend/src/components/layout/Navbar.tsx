import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
    MenubarTrigger,
} from "@/components/ui/menubar";
import { SiChessdotcom } from "react-icons/si";
import { Link } from "react-router";

const Navbar = () => {
    return (
        <nav className="w-full flex items-center justify-between px-6 py-4 shadow-2xs bg-white">
            <div className="flex items-center">
                <Link to="/" className="flex items-center gap-2 font-bold text-xl">
                    <SiChessdotcom className="text-2xl" />
                    <span className="text-2xl">Dabaru.com</span>
                </Link>
            </div>

            <div className="flex-1 flex justify-center ml-[-85px]">
                <Menubar className="gap-6">
                    <MenubarMenu>
                        <MenubarTrigger>Play</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem>Create a Game</MenubarItem>
                            <MenubarSeparator />
                            <MenubarSub>
                                <MenubarSubTrigger>Join Tournament</MenubarSubTrigger>
                                <MenubarSubContent>
                                    <MenubarItem>Arena Tournament</MenubarItem>
                                    <MenubarItem>Global Tournament</MenubarItem>
                                    <MenubarItem>Simultaneous Exhibitions</MenubarItem>
                                </MenubarSubContent>
                            </MenubarSub>
                        </MenubarContent>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger>Learn</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem>Basics</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Openings</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Puzzles</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>GM Masterclass</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger>Watch</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem>Broadcasts</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Dabaru TV</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Current Games</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Streamers</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Video Library</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger>Community</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem>Friends</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Teams</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Clubs</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Forums</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Blogs</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger>Analysis</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem>Analyze Your Game</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Analyze Classic Games</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Board Editor</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Import Game</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger>Shop</MenubarTrigger>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger>Donate</MenubarTrigger>
                    </MenubarMenu>
                </Menubar>
            </div>

            <div className="flex items-center">
                <Menubar>
                    <MenubarMenu>
                        <MenubarTrigger>
                            <Link to="/Login">
                                Log in
                            </Link>
                        </MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem>Profile</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Inbox</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Preferences</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Log out</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem>Language</MenubarItem>
                            <MenubarItem>Sound</MenubarItem>
                            <MenubarItem>Chess Piece Set</MenubarItem>
                            <MenubarItem>Board</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>
            </div>
        </nav>
    );
};

export default Navbar;
