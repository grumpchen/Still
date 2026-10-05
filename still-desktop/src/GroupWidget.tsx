import type {WidgetProps} from './widgets.tsx';
import GroupEditor from './GroupEditor.tsx';

export default function GroupWidget({widget,group,update,updateGroup,openResource,openGroupWidget}:WidgetProps){
 const collection=group??{id:widget.groupId??widget.id,name:widget.title,shortcuts:widget.shortcuts,widgets:[],expanded:false};
 return <GroupEditor group={collection} update={patch=>updateGroup?updateGroup(patch):update({title:patch.name??widget.title,shortcuts:patch.shortcuts??widget.shortcuts})} openLink={openResource} openWidget={openGroupWidget}/>;
}
